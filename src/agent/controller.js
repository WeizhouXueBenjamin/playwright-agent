const { observePage } = require("./observer");
const { runDecisionCycle } = require("./decision-cycle");
const { launchChromium, launchPersistentChromiumContext } = require("../browser/browser");
const { openPage, openPageInContext } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { runVerifiedAction } = require("../execution/verified-action-runner");
const { RecoveryEngine } = require("../recovery/recovery-engine");
const { gateStepForCurrentObservation } = require("./decision-gate");
const { buildFieldFingerprint, buildReviewAnswer, formatReviewPrompt, normalizeReviewPrompt } = require("../review/review-resolution");
const { StateManager } = require("../state/state-manager");

class AgentController {
	constructor(options = {}) {
		this.options = {
			maxCycles: 20,
			...options,
		};
		this.recoveryEngine = options.recoveryEngine || new RecoveryEngine(options.recovery || {});
	}

	async run(url, profile) {
		if (this.options.persistent) {
			const context = await launchPersistentChromiumContext({
				headless: this.options.headless,
				userDataDir: this.options.userDataDir,
				viewport: this.options.viewport,
			});

			try {
				const page = await openPageInContext(context, url, this.options);
				await waitForPageStable(page, this.options.stability);
				return await this.runOnPage(page, profile);
			} finally {
				await context.close();
			}
		}

		const browser = await launchChromium({ headless: this.options.headless });

		try {
			const { context, page } = await openPage(browser, url, this.options);
			try {
				await waitForPageStable(page, this.options.stability);
				return await this.runOnPage(page, profile);
			} finally {
				await context.close();
			}
		} finally {
			await browser.close();
		}
	}

	async runOnPage(page, profile) {
		const lifecycle = [];
		const stateManager = new StateManager(this.options.goal || "");
		stateManager.setExecutionStatus("running");

		for (let cycle = 1; cycle <= this.options.maxCycles; cycle += 1) {
			const observation = await observePage(page);
			stateManager.applyObservation(observation);
			const observedRuntimeState = stateManager.getState();
			const decisionCycle = runDecisionCycle({
				goal: this.options.goal || "",
				observation,
				profile,
				runtimeState: observedRuntimeState,
				options: this.options,
			});
			const plannerDecision = decisionCycle.plannerDecision;
			const terminalState = decisionCycle.terminalState;

			const lifecycleEntry = {
				cycle,
				phase: "observe-think",
				timestamp: new Date().toISOString(),
				url: observation.semanticPage.url,
				pageSummary: observation.semanticPage.summary,
				decision: decisionCycle.decision,
				terminalState,
				runtimeStateSnapshot: observedRuntimeState,
			};

			if (terminalState.reached) {
				if (terminalState.status === "needs-review" && isFieldReviewItem(terminalState.details)) {
					const reviewResolution = await this.resolveReview({
						page,
						reviewItem: terminalState.details || {},
						fallbackReason: terminalState.reason,
						lifecycleEntry,
						stateManager,
						lifecycle,
					});
					if (reviewResolution.continueRun) continue;
					return reviewResolution.result;
				}

				stateManager.setExecutionStatus(terminalState.status);
				lifecycle.push({
					...lifecycleEntry,
					runtimeStateSnapshot: stateManager.getState(),
				});
				return {
					status: terminalState.status,
					reason: terminalState.reason,
					runtimeState: stateManager.getState(),
					lifecycle,
				};
			}

			const gateStep = this.options.gateStep || gateStepForCurrentObservation;
			const gateResult = await gateStep({
				step: plannerDecision.step,
				observation,
				runtimeState: stateManager.getState(),
				profile,
				goal: this.options.goal || "",
				history: lifecycle,
			});
			stateManager.recordDecisionGateResult(gateResult);

			if (gateResult.type !== "approved-action") {
				const gateLifecycleEntry = {
					...lifecycleEntry,
					phase: "observe-think-gate",
					timestamp: new Date().toISOString(),
					decisionGate: summarizeGateResult(gateResult),
					runtimeStateSnapshot: stateManager.getState(),
				};
				if (gateResult.type === "review-item") {
					const reviewResolution = await this.resolveReview({
						page,
						reviewItem: buildGateReviewItem(gateResult),
						fallbackReason: gateResult.reason,
						lifecycleEntry: gateLifecycleEntry,
						stateManager,
						lifecycle,
					});
					if (reviewResolution.continueRun) continue;
					return reviewResolution.result;
				}
				lifecycle.push(gateLifecycleEntry);
				if (gateResult.reason === "runtime-state-already-completed") continue;
				stateManager.setExecutionStatus("verification-failed");
				return {
					status: "verification-failed",
					reason: gateResult.reason,
					runtimeState: stateManager.getState(),
					lifecycle,
				};
			}

			const actionResult = await runVerifiedAction({
				page,
				step: gateResult.step,
				beforeObservation: observation,
				interactionStability: this.options.interactionStability,
			});
			if (actionResult.verification.ok) {
				stateManager.applySuccessfulAction(gateResult.step, actionResult.verification);
			}
			lifecycle.push({
				...lifecycleEntry,
				phase: "observe-think-act-verify",
				timestamp: new Date().toISOString(),
				actionResult,
				decisionGate: summarizeGateResult(gateResult),
				runtimeStateSnapshot: stateManager.getState(),
			});

			if (!actionResult.verification.ok) {
				const recovery = await this.recoveryEngine.recover({
					page,
					profile,
					step: gateResult.step,
					actionResult,
					beforeObservation: observation,
					stateManager,
					goal: this.options.goal || "",
					lifecycle,
				});
				lifecycle[lifecycle.length - 1].recovery = summarizeRecovery(recovery);
				lifecycle[lifecycle.length - 1].runtimeStateSnapshot = stateManager.getState();

				if (recovery.status === "recovered") {
					continue;
				}

				const terminalStatus = recovery.status === "needs-user-confirmation"
					? "needs-user-confirmation"
					: "recovery-failed";
				stateManager.setExecutionStatus(terminalStatus);
				lifecycle[lifecycle.length - 1].runtimeStateSnapshot = stateManager.getState();

				return {
					status: terminalStatus,
					reason: recovery.status === "needs-user-confirmation" ? "recovery-needs-user-confirmation" : "recovery-failed",
					failedCycle: cycle,
					recovery,
					runtimeState: stateManager.getState(),
					lifecycle,
				};
			}
		}

		stateManager.setExecutionStatus("max-cycles-reached");
		return {
			status: "max-cycles-reached",
			reason: "The autonomous loop reached its configured cycle limit.",
			runtimeState: stateManager.getState(),
			lifecycle,
		};
	}

	async resolveReview({ page, reviewItem, fallbackReason, lifecycleEntry, stateManager, lifecycle }) {
		let reviewPrompt = normalizeReviewPrompt(reviewItem);
		stateManager.recordReviewPrompt(reviewPrompt);

		if (typeof this.options.reviewAnswerProvider !== "function") {
			stateManager.setExecutionStatus("needs-review");
			const promptedLifecycleEntry = buildPromptedLifecycleEntry(lifecycleEntry, reviewPrompt, stateManager);
			lifecycle.push(promptedLifecycleEntry);
			return {
				continueRun: false,
				result: buildReviewResult({
					status: "needs-review",
					reason: fallbackReason || "review-channel-unavailable",
					reviewPrompt,
					stateManager,
					lifecycle,
				}),
			};
		}

		while (true) {
			stateManager.setExecutionStatus("review-pending");
			const promptedState = stateManager.getState();
			const promptedLifecycleEntry = buildPromptedLifecycleEntry(lifecycleEntry, reviewPrompt, stateManager);
			const providedAnswer = await this.options.reviewAnswerProvider({
				reviewPrompt,
				reviewItem,
				runtimeState: promptedState,
				page,
			});

			if (providedAnswer === undefined || providedAnswer === null) {
				stateManager.setExecutionStatus("needs-review");
				lifecycle.push({
					...promptedLifecycleEntry,
					phase: "observe-think-review-channel-unavailable",
					runtimeStateSnapshot: stateManager.getState(),
				});
				return {
					continueRun: false,
					result: buildReviewResult({
						status: "needs-review",
						reason: "review-channel-unavailable",
						reviewPrompt,
						stateManager,
						lifecycle,
					}),
				};
			}

			const reviewCommand = typeof providedAnswer === "object" && !Array.isArray(providedAnswer)
				? providedAnswer.command || "answer"
				: "answer";
			if (reviewCommand === "stop") {
				stateManager.setExecutionStatus("needs-review");
				lifecycle.push({
					...promptedLifecycleEntry,
					phase: "observe-think-review-stopped",
					runtimeStateSnapshot: stateManager.getState(),
				});
				return {
					continueRun: false,
					result: buildReviewResult({
						status: "needs-review",
						reason: "stopped-by-user",
						reviewPrompt,
						stateManager,
						lifecycle,
					}),
				};
			}
			if (reviewCommand === "skip") {
				stateManager.recordSkippedField(reviewPrompt);
				stateManager.setExecutionStatus("running");
				lifecycle.push({
					...promptedLifecycleEntry,
					phase: "observe-think-review-skipped",
					runtimeStateSnapshot: stateManager.getState(),
				});
				return { continueRun: true };
			}
			if (reviewCommand === "manual") {
				const manualVerification = await verifyManualCompletion(page, reviewPrompt);
				if (!manualVerification.ok) {
					lifecycle.push({
						...promptedLifecycleEntry,
						phase: "observe-think-review-manual-unverified",
						manualVerification,
						runtimeStateSnapshot: stateManager.getState(),
					});
					reviewPrompt = {
						...reviewPrompt,
						message: `Manual completion was not verified (${manualVerification.reason}). ${reviewPrompt.message}`,
					};
					continue;
				}
				stateManager.recordManualCompletion(reviewPrompt);
				stateManager.setExecutionStatus("running");
				lifecycle.push({
					...promptedLifecycleEntry,
					phase: "observe-think-review-manual",
					manualVerification,
					runtimeStateSnapshot: stateManager.getState(),
				});
				return { continueRun: true };
			}

			const reviewAnswer = buildReviewAnswer({
				...(typeof providedAnswer === "object" && !Array.isArray(providedAnswer)
					? providedAnswer
					: { answer: providedAnswer }),
				reviewPrompt,
				reviewItem,
			});
			stateManager.recordReviewAnswer(reviewAnswer);
			stateManager.setExecutionStatus("running");
			lifecycle.push({
				...promptedLifecycleEntry,
				phase: "observe-think-review-resolved",
				reviewAnswer: summarizeReviewAnswer(reviewAnswer),
				runtimeStateSnapshot: stateManager.getState(),
			});
			return { continueRun: true };
		}
	}

}

function buildGateReviewItem(gateResult) {
	return {
		field: gateResult.field || gateResult.step && gateResult.step.field || {},
		matchedProfileProperty: gateResult.step && gateResult.step.profileProperty || null,
		safetyDecision: gateResult.safetyDecision || {},
		reason: gateResult.reason || "review-required",
	};
}

function isFieldReviewItem(reviewItem) {
	return Boolean(reviewItem && reviewItem.field && reviewItem.field.id);
}

function buildPromptedLifecycleEntry(lifecycleEntry, reviewPrompt, stateManager) {
	return {
		...lifecycleEntry,
		reviewPrompt,
		reviewPromptText: formatReviewPrompt(reviewPrompt),
		runtimeStateSnapshot: stateManager.getState(),
	};
}

function buildReviewResult({ status, reason, reviewPrompt, stateManager, lifecycle }) {
	return {
		status,
		reason,
		reviewPrompt,
		reviewPromptText: formatReviewPrompt(reviewPrompt),
		runtimeState: stateManager.getState(),
		lifecycle,
	};
}

function summarizeReviewAnswer(reviewAnswer) {
	return {
		fieldIntent: reviewAnswer.fieldIntent,
		fieldFingerprint: reviewAnswer.fieldFingerprint,
		source: reviewAnswer.source,
		scope: reviewAnswer.scope,
		resolutionMethod: reviewAnswer.resolutionMethod,
		authorizedAt: reviewAnswer.authorizedAt,
		safetyReasonResolved: reviewAnswer.safetyReasonResolved,
	};
}

async function verifyManualCompletion(page, reviewPrompt) {
	const observation = await observePage(page);
	const field = (observation.semanticPage.interactiveElements || []).find((element) => {
		return buildFieldFingerprint(element) === reviewPrompt.fieldFingerprint || element.id === reviewPrompt.fieldId;
	});
	if (!field) return { ok: false, reason: "manual-field-not-found" };
	if (!isFieldCompleted(field)) return { ok: false, reason: "manual-field-unchanged-or-invalid" };
	if (field.validation && field.validation.valid === false) return { ok: false, reason: "manual-field-invalid" };
	return {
		ok: true,
		reason: "manual-field-verified",
		fieldId: field.id,
	};
}

function isFieldCompleted(field) {
	const state = field.state || {};
	if (field.kind === "checkbox" || field.kind === "radio") return state.checked === true;
	if (field.kind === "selection") return Boolean(state.value || state.selectedLabel);
	if (Array.isArray(state.files)) return state.files.length > 0;
	return Boolean(String(state.value || "").trim());
}

function summarizeRecovery(recovery) {
	return {
		status: recovery.status,
		strategy: recovery.strategy,
		failureType: recovery.failure && recovery.failure.type,
		message: recovery.message || "",
		retryAttempt: recovery.retryAttempt || 0,
	};
}

function summarizeGateResult(gateResult) {
	return {
		type: gateResult.type,
		reason: gateResult.reason,
		decisionId: gateResult.decisionId,
		provenance: gateResult.provenance,
	};
}

module.exports = {
	AgentController,
};
