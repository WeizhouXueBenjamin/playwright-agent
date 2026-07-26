const fs = require("node:fs");

const { inspectSelectionOptions, resetCustomSelectionSearch } = require("../actions/selection-options");
const { observePage } = require("./observer");
const { runDecisionCycle } = require("./decision-cycle");
const { launchChromium, launchPersistentChromiumContext } = require("../browser/browser");
const { openPage, openPageInContext } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { runVerifiedAction } = require("../execution/verified-action-runner");
const { RecoveryEngine } = require("../recovery/recovery-engine");
const { gateStepForCurrentObservation } = require("./decision-gate");
const { classifyFieldIntent } = require("../reasoning/field-answer-safety");
const { buildReviewCheckpoint } = require("../review/review-checkpoint");
const { REVIEW_ALLOWED_ACTIONS, REVIEW_TYPES } = require("../review/review-types");
const { buildFieldFingerprint, buildReviewAnswer } = require("../review/review-resolution");
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
				channel: this.options.channel,
				chromiumSandbox: this.options.chromiumSandbox,
				headless: this.options.headless,
				userDataDir: this.options.userDataDir,
				viewport: this.options.viewport,
			});

			try {
				const page = await openPageInContext(context, url, this.options);
				await waitForPageStable(page, this.options.stability);
				const result = await this.runOnPage(page, profile);
				return await this.maybeHoldForFinalReview({ page, result });
			} finally {
				await context.close();
			}
		}

		const browser = await launchChromium({ headless: this.options.headless });

		try {
			const { context, page } = await openPage(browser, url, this.options);
			try {
				await waitForPageStable(page, this.options.stability);
				const result = await this.runOnPage(page, profile);
				return await this.maybeHoldForFinalReview({ page, result });
			} finally {
				await context.close();
			}
		} finally {
			await browser.close();
		}
	}

	async maybeHoldForFinalReview({ page, result }) {
		if (!shouldInvokeFinalReview({ page, result, finalReviewProvider: this.options.finalReviewProvider })) {
			return result;
		}

		const abortController = new AbortController();
		let closeReason = "";
		const markClosed = () => {
			closeReason = "browser-closed";
			abortController.abort();
		};
		const context = page.context();
		page.once("close", markClosed);
		context.once("close", markClosed);

		try {
			const decision = await this.options.finalReviewProvider({
				summary: buildFinalReviewSummary(result),
				signal: abortController.signal,
			});
			if (closeReason) return attachFinalReview(result, closeReason);
			return attachFinalReview(result, stateForFinalReviewDecision(decision));
		} catch {
			return attachFinalReview(result, closeReason || "stopped-by-user");
		} finally {
			page.off("close", markClosed);
			context.off("close", markClosed);
		}
	}

	async runOnPage(page, profile) {
		const lifecycle = [];
		const stateManager = new StateManager(this.options.goal || "");
		let manualLoginAttempts = 0;
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
				if (terminalState.reason === "login-required"
					&& typeof this.options.manualLoginProvider === "function") {
					if (manualLoginAttempts >= 2) {
						stateManager.setExecutionStatus("needs-review");
						lifecycle.push({
							...lifecycleEntry,
							phase: "observe-think-manual-login-stopped",
							manualIntervention: buildManualLoginIntervention("stopped", manualLoginAttempts),
							runtimeStateSnapshot: stateManager.getState(),
						});
						return {
							status: "needs-review",
							reason: "login-required",
							runtimeState: stateManager.getState(),
							lifecycle,
						};
					}

					manualLoginAttempts += 1;
					stateManager.setExecutionStatus("awaiting-manual-login");
					const decision = await requestManualLoginDecision({
						page,
						provider: this.options.manualLoginProvider,
						attempt: manualLoginAttempts,
						maxAttempts: 2,
					});
					let resumed = decision.action === "resume";
					if (resumed) resumed = await settleAfterManualLogin(page);
					stateManager.setExecutionStatus(resumed ? "running" : "needs-review");
					lifecycle.push({
						...lifecycleEntry,
						phase: resumed ? "observe-think-manual-login-resumed" : "observe-think-manual-login-stopped",
						manualIntervention: buildManualLoginIntervention(resumed ? "resumed" : "stopped", manualLoginAttempts),
						runtimeStateSnapshot: stateManager.getState(),
					});

					if (resumed) continue;

					return {
						status: "needs-review",
						reason: "login-required",
						runtimeState: stateManager.getState(),
						lifecycle,
					};
				}

				if (terminalState.status === "needs-review" && isReviewDetails(terminalState.details)) {
					const checkpointResolution = await this.resolveReviewCheckpoint({
						page,
						checkpointDetails: normalizeCheckpointDetails(terminalState.details, terminalState.reason),
						fallbackReason: terminalState.reason,
						lifecycleEntry,
						stateManager,
						lifecycle,
					});
					if (checkpointResolution.continueRun) continue;
					return checkpointResolution.result;
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
					const reviewResolution = await this.resolveReviewCheckpoint({
						page,
						checkpointDetails: normalizeCheckpointDetails(buildGateReviewItem(gateResult), gateResult.reason),
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
				if (shouldCreateOptionReviewCheckpoint(gateResult.step, actionResult)) {
					const optionReviewResolution = await this.resolveReviewCheckpoint({
						page,
						checkpointDetails: {
							reviewItems: [await buildOptionReviewItem(page, gateResult.step, actionResult)],
							reason: "option-match-needs-review",
							pageUrl: observation.semanticPage.url,
							pageTitle: observation.semanticPage.title,
						},
						fallbackReason: "option-match-needs-review",
						lifecycleEntry: {
							...lifecycleEntry,
							phase: "observe-think-option-review",
							actionResult,
							decisionGate: summarizeGateResult(gateResult),
						},
						stateManager,
						lifecycle,
					});
					if (optionReviewResolution.continueRun) continue;
					return optionReviewResolution.result;
				}

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
				if (shouldSkipUnsupportedOptionalSelection(gateResult.step, recovery)) {
					await resetCustomSelectionSearch(page, gateResult.step.field).catch(() => {});
					stateManager.recordSkippedField({
						fieldFingerprint: buildFieldFingerprint(gateResult.step.field),
						fieldId: gateResult.step.field.id,
						fieldIntent: "low-risk-optional-selection",
						fieldLabel: gateResult.step.field.label,
						controlType: gateResult.step.field.kind,
					});
					lifecycle[lifecycle.length - 1].recovery = summarizeRecovery({
						...recovery,
						status: "skipped",
						strategy: "skip-unsupported-optional-selection",
						message: "Optional selection had no unique compatible option and was skipped.",
					});
					lifecycle[lifecycle.length - 1].runtimeStateSnapshot = stateManager.getState();
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

	async resolveReviewCheckpoint({ page, checkpointDetails, fallbackReason, lifecycleEntry, stateManager, lifecycle }) {
		const reviewItems = await enrichReviewItemsWithOptions(page, checkpointDetails.reviewItems || []);
		let checkpoint = buildReviewCheckpoint({
			reviewItems,
			pageUrl: checkpointDetails.pageUrl || lifecycleEntry.url,
			pageTitle: checkpointDetails.pageTitle || "",
			reason: checkpointDetails.reason || fallbackReason,
		});
		stateManager.recordReviewCheckpoint(checkpoint);

		if (typeof this.options.reviewCheckpointProvider !== "function") {
			stateManager.setExecutionStatus("needs-review");
			lifecycle.push({
				...lifecycleEntry,
				phase: "observe-think-review-checkpoint-pending",
				reviewCheckpoint: checkpoint,
				runtimeStateSnapshot: stateManager.getState(),
			});
			return {
				continueRun: false,
				result: {
					status: "needs-review",
					reason: "review-checkpoint-pending",
					reviewCheckpoint: checkpoint,
					runtimeState: stateManager.getState(),
					lifecycle,
				},
			};
		}

		while (true) {
			stateManager.setExecutionStatus("review-pending");
			const decisions = await this.options.reviewCheckpointProvider({
				reviewCheckpoint: checkpoint,
				runtimeState: stateManager.getState(),
				page,
			});
			if (!Array.isArray(decisions)) {
				stateManager.setExecutionStatus("needs-review");
				return {
					continueRun: false,
					result: {
						status: "needs-review",
						reason: "review-channel-unavailable",
						reviewCheckpoint: checkpoint,
						runtimeState: stateManager.getState(),
						lifecycle,
					},
				};
			}

			const outcome = await applyCheckpointDecisions({
				page,
				checkpoint,
				decisions,
				stateManager,
			});
			checkpoint = {
				...checkpoint,
				decisions: outcome.recordedDecisions,
				status: outcome.stopReason ? "waiting-for-user" : "resolved",
				reason: outcome.stopReason && isRecoverableReviewStop(outcome.stopReason)
					? outcome.stopReason
					: checkpoint.reason,
			};
			stateManager.recordReviewCheckpoint(checkpoint);

			if (outcome.stopReason && isRecoverableReviewStop(outcome.stopReason)) {
				lifecycle.push({
					...lifecycleEntry,
					phase: "observe-think-review-checkpoint-unresolved",
					reviewCheckpoint: checkpoint,
					runtimeStateSnapshot: stateManager.getState(),
				});
				continue;
			}

			lifecycle.push({
				...lifecycleEntry,
				phase: outcome.stopReason ? "observe-think-review-checkpoint-stopped" : "observe-think-review-checkpoint-resolved",
				reviewCheckpoint: checkpoint,
				runtimeStateSnapshot: stateManager.getState(),
			});

			if (outcome.stopReason) {
				stateManager.setExecutionStatus("needs-review");
				return {
					continueRun: false,
					result: {
						status: "needs-review",
						reason: outcome.stopReason,
						reviewCheckpoint: checkpoint,
						runtimeState: stateManager.getState(),
						lifecycle,
					},
				};
			}

			stateManager.setExecutionStatus("running");
			return { continueRun: true };
		}
	}

}

async function enrichReviewItemsWithOptions(page, reviewItems) {
	const enriched = [];
	for (const reviewItem of reviewItems) {
		const field = reviewItem.field || {};
		if (field.kind !== "selection" || (field.options || []).length) {
			enriched.push(reviewItem);
			continue;
		}
		try {
			const snapshot = await inspectSelectionOptions(page, field);
			enriched.push({
				...reviewItem,
				field: { ...field, options: snapshot.options },
				optionSnapshot: snapshot,
			});
		} catch (error) {
			enriched.push({
				...reviewItem,
				optionInspectionError: error.message,
			});
		}
	}
	return enriched;
}

async function buildOptionReviewItem(page, step, actionResult) {
	const snapshot = await inspectSelectionOptions(page, step.field).catch(() => null);
	const optionMatch = actionResult.verification && actionResult.verification.optionMatch || {};
	const fallbackOptions = (optionMatch.candidates || []).map((candidate) => ({
		label: candidate.label,
	})).filter((option) => option.label);
	const reviewOptions = fallbackOptions.length
		? fallbackOptions
		: snapshot && snapshot.options || [];
	const field = { ...step.field, options: reviewOptions };
	const fieldIntent = classifyFieldIntent(field);
	return {
		field,
		matchedProfileProperty: {
			path: step.profileProperty && step.profileProperty.path || "",
			valueType: typeof step.actionValue,
			valuePresent: true,
			valuePreview: redactOptionReviewValue(step, step.actionValue),
			source: step.profileProperty && step.profileProperty.source || "",
		},
		reason: optionMatch.reason || "option-match-needs-review",
		message: "The proposed answer did not resolve to one safe live option.",
		confidenceScore: step.confidenceScore || 0,
		safetyDecision: {
			...(step.safetyDecision || {}),
			fieldIntent: step.safetyDecision && step.safetyDecision.fieldIntent || fieldIntent.fieldIntent,
			riskLevel: step.safetyDecision && step.safetyDecision.riskLevel || fieldIntent.riskLevel,
			reason: optionMatch.reason || "option-match-needs-review",
			optionMatch,
			evidence: [
				{ type: "option-match-tier", value: optionMatch.tier || "none" },
				{ type: "option-match-reason", value: optionMatch.reason || "option-match-needs-review" },
				...(optionMatch.candidates || []).map((candidate) => ({ type: "candidate", value: candidate.label })),
			],
		},
		optionSnapshot: snapshot || {
			snapshotId: "",
			complete: false,
			options: field.options || [],
		},
	};
}

function shouldCreateOptionReviewCheckpoint(step, actionResult) {
	if (!step || step.action !== "select-option") return false;
	const optionMatch = actionResult && actionResult.verification && actionResult.verification.optionMatch;
	if (!optionMatch) return false;
	if (step.field && step.field.required) return true;
	const fieldIntent = step.safetyDecision && step.safetyDecision.fieldIntent || "";
	return fieldIntent && fieldIntent !== "low-risk";
}

function redactOptionReviewValue(step, value) {
	const fieldIntent = step.safetyDecision && step.safetyDecision.fieldIntent || "";
	if (/salary|demographic|self-identification/i.test(fieldIntent)) return "[redacted]";
	return String(value || "");
}

async function applyCheckpointDecisions({ page, checkpoint, decisions, stateManager }) {
	const decisionValidation = validateCheckpointDecisions(checkpoint, decisions);
	if (!decisionValidation.ok) {
		return {
			recordedDecisions: decisionValidation.recordedDecisions,
			stopReason: decisionValidation.reason,
		};
	}

	for (const item of checkpoint.items || []) {
		const decision = decisions.find((candidate) => candidate && candidate.itemId === item.id);
		if (decision.action !== "manual") continue;
		const manualVerification = await verifyManualCompletion(page, item.legacyPrompt);
		if (!manualVerification.ok) {
			return { recordedDecisions: [], stopReason: manualVerification.reason };
		}
	}

	const recordedDecisions = [];
	for (const item of checkpoint.items || []) {
		const decision = decisions.find((candidate) => candidate && candidate.itemId === item.id);
		const recordedDecision = toRecordedDecision(item, decision);
		recordedDecisions.push(recordedDecision);

		if (decision.action === "stop") return { recordedDecisions, stopReason: "stopped-by-user" };
		if (decision.action === "decline") return { recordedDecisions, stopReason: "consent-declined" };
		if (["skip", "prefer-not-to-answer"].includes(decision.action)) {
			stateManager.recordSkippedField(item.legacyPrompt);
			continue;
		}
		if (decision.action === "manual") {
			stateManager.recordManualCompletion(item.legacyPrompt);
			continue;
		}
		const answer = answerForDecision(item, decision);
		const authorizedAt = new Date().toISOString();
		const reviewAnswer = buildReviewAnswer({
			answer,
			authorizedAt,
			authorization: decision.action === "authorize" ? {
				authorizationType: "consent",
				authorized: true,
				consentScope: item.fieldIntent === "privacy-consent" ? "privacy-policy" : "legal-declaration",
				statementFingerprint: item.statementFingerprint,
				authorizedAt,
			} : null,
			resolutionMethod: recordedDecision.resolutionMethod,
			reviewPrompt: item.legacyPrompt,
			reviewItem: {
				field: {
					id: item.fieldId,
					kind: item.controlType,
					label: item.fieldLabel,
					statementFingerprint: item.statementFingerprint,
				},
				safetyDecision: {
					fieldIntent: item.fieldIntent,
				},
			},
		});
		stateManager.recordReviewAnswer(reviewAnswer);
	}
	return { recordedDecisions, stopReason: "" };
}

function validateCheckpointDecisions(checkpoint, decisions) {
	const recordedDecisions = [];
	const checkpointItems = checkpoint.items || [];
	const checkpointStop = (decisions || []).find((decision) => decision
		&& decision.itemId === "__checkpoint"
		&& decision.action === "stop");
	if (checkpointStop) return { ok: false, reason: "stopped-by-user", recordedDecisions };
	const itemStop = (decisions || []).find((decision) => decision && ["stop", "decline"].includes(decision.action));
	if (itemStop) {
		const item = checkpointItems.find((candidate) => candidate.id === itemStop.itemId);
		if (!item) return { ok: false, reason: "review-decision-item-not-found", recordedDecisions };
		if (!item.allowedActions.includes(itemStop.action)) {
			return { ok: false, reason: "review-decision-action-not-allowed", recordedDecisions };
		}
		recordedDecisions.push(toRecordedDecision(item, itemStop));
		return {
			ok: false,
			reason: itemStop.action === "decline" ? "consent-declined" : "stopped-by-user",
			recordedDecisions,
		};
	}

	const decisionsByItem = new Map();
	for (const decision of decisions || []) {
		if (!decision || !decision.itemId) {
			return { ok: false, reason: "review-decision-invalid", recordedDecisions };
		}
		if (decision.itemId === "__checkpoint") {
			return { ok: false, reason: "review-decision-action-not-allowed", recordedDecisions };
		}
		const item = checkpointItems.find((candidate) => candidate.id === decision.itemId);
		if (!item) {
			recordedDecisions.push({
				itemId: decision.itemId,
				action: decision.action || "unknown",
				decidedAt: new Date().toISOString(),
			});
			return { ok: false, reason: "review-decision-item-not-found", recordedDecisions };
		}
		const action = decision.action || "";
		if (!item.allowedActions.includes(action)) {
			recordedDecisions.push({
				itemId: item.id,
				fieldFingerprint: item.fieldFingerprint,
				type: item.type,
				action,
				decidedAt: new Date().toISOString(),
			});
			return { ok: false, reason: "review-decision-action-not-allowed", recordedDecisions };
		}
		if (decisionsByItem.has(item.id)) {
			return { ok: false, reason: "review-decision-duplicate", recordedDecisions };
		}
		const valueReason = validateDecisionValue(item, decision);
		if (valueReason) return { ok: false, reason: valueReason, recordedDecisions };
		decisionsByItem.set(item.id, decision);
	}
	for (const item of checkpointItems) {
		if (!decisionsByItem.has(item.id)) {
			return { ok: false, reason: "review-decision-missing", recordedDecisions };
		}
	}
	return { ok: true, reason: "", recordedDecisions };
}

function validateDecisionValue(item, decision) {
	if (decision.action === "authorize" && (item.options || []).length) {
		if (!hasValue(decision.value)) return "review-decision-value-required";
		if (!(item.options || []).some((option) => option.label === decision.value)) {
			return "review-decision-option-not-available";
		}
	}
	if (decision.action === "confirm" && !hasValue(item.proposedValue)) return "review-decision-proposed-value-missing";
	if (["replace", "provide-value"].includes(decision.action) && !hasValue(decision.value || decision.answer)) {
		return "review-decision-value-required";
	}
	if (decision.action === "select") {
		if (!hasValue(decision.value)) return "review-decision-value-required";
		if (!(item.options || []).some((option) => option.label === decision.value)) {
			return "review-decision-option-not-available";
		}
	}
	if (decision.action === "provide-file") {
		if (!hasValue(decision.value)) return "review-decision-value-required";
		try {
			if (!fs.statSync(decision.value).isFile()) return "review-decision-file-not-found";
		} catch {
			return "review-decision-file-not-found";
		}
	}
	if (decision.action === "prefer-not-to-answer" && !(item.metadata && item.metadata.allowPreferNotToAnswer)) {
		return "review-decision-action-not-allowed";
	}
	return "";
}

function toRecordedDecision(item, decision) {
	return {
		itemId: item.id,
		fieldFingerprint: item.fieldFingerprint,
		type: item.type,
		action: decision.action,
		resolutionMethod: resolutionMethodForDecision(decision),
		decidedAt: new Date().toISOString(),
	};
}

function hasValue(value) {
	return typeof value === "boolean" || String(value || "").trim().length > 0;
}

function answerForDecision(item, decision) {
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION && decision.action === "authorize") {
		return (item.options || []).length ? decision.value : true;
	}
	if (decision.action === "confirm") return item.proposedValue;
	if (decision.action === "select") return decision.value;
	return decision.value || decision.answer || "";
}

function resolutionMethodForDecision(decision = {}) {
	if (decision.action === "confirm" || decision.action === "authorize") return "user-confirmed";
	if (decision.action === "replace" || decision.action === "provide-value" || decision.action === "select") return "user-edited";
	if (decision.action === "manual") return "manual";
	if (decision.action === "skip" || decision.action === "prefer-not-to-answer" || decision.action === "decline") return "skipped";
	return "user-edited";
}

function isRecoverableReviewStop(reason) {
	return String(reason || "").startsWith("manual-field-")
		|| String(reason || "").startsWith("review-decision-");
}

function isReviewDetails(details) {
	return Boolean(details && (Array.isArray(details.reviewItems) || isFieldReviewItem(details)));
}

function normalizeCheckpointDetails(details, fallbackReason) {
	if (Array.isArray(details.reviewItems)) return details;
	return {
		reviewItems: [details],
		reason: details.reason || fallbackReason || "review-required",
	};
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

function shouldSkipUnsupportedOptionalSelection(step, recovery) {
	if (!step || step.action !== "select-option" || step.field && step.field.required) return false;
	const errors = [
		recovery && recovery.failure && recovery.failure.verification && recovery.failure.verification.error,
		recovery && recovery.actionResult && recovery.actionResult.verification && recovery.actionResult.verification.error,
	].filter(Boolean);
	return errors.length > 0 && errors.every((error) => /compatible live option|selectable option matched/i.test(String(error)));
}

function summarizeGateResult(gateResult) {
	return {
		type: gateResult.type,
		reason: gateResult.reason,
		decisionId: gateResult.decisionId,
		provenance: gateResult.provenance,
	};
}

async function requestManualLoginDecision({ page, provider, attempt, maxAttempts }) {
	const abortController = new AbortController();
	let browserClosed = false;
	const markClosed = () => {
		browserClosed = true;
		abortController.abort();
	};
	const context = page.context();
	page.once("close", markClosed);
	context.once("close", markClosed);

	try {
		const decision = await provider({
			attempt,
			maxAttempts,
			signal: abortController.signal,
		});
		if (browserClosed || !decision || decision.action !== "resume") return { action: "stop" };
		return { action: "resume" };
	} catch {
		return { action: "stop" };
	} finally {
		page.off("close", markClosed);
		context.off("close", markClosed);
	}
}

async function settleAfterManualLogin(page) {
	if (!page || page.isClosed()) return false;
	await Promise.allSettled([
		page.waitForTimeout(500),
		page.waitForLoadState("domcontentloaded", { timeout: 1500 }),
	]);
	return !page.isClosed();
}

function buildManualLoginIntervention(outcome, attempts) {
	return {
		type: "manual-login",
		outcome,
		attempts,
	};
}

function shouldInvokeFinalReview({ page, result, finalReviewProvider }) {
	if (typeof finalReviewProvider !== "function") return false;
	if (!result || result.status !== "awaiting-human-confirmation") return false;
	if (result.reason !== "final-submission-control-detected") return false;
	const runtimeState = result.runtimeState || {};
	if (runtimeState.pendingReviewCheckpoint) return false;
	if (!page || page.isClosed()) return false;
	return true;
}

function buildFinalReviewSummary(result) {
	const runtimeState = result.runtimeState || {};
	return {
		status: "ready-for-review",
		internalStatus: result.status,
		reason: result.reason || "",
		verifiedFields: Array.isArray(runtimeState.completedFields) ? runtimeState.completedFields.length : 0,
		reviewDecisionsApplied: Array.isArray(runtimeState.reviewAnswers) ? runtimeState.reviewAnswers.length : 0,
		skippedFields: Array.isArray(runtimeState.skippedFields) ? runtimeState.skippedFields.length : 0,
		pendingReviewItems: runtimeState.pendingReviewCheckpoint && Array.isArray(runtimeState.pendingReviewCheckpoint.items)
			? runtimeState.pendingReviewCheckpoint.items.length
			: 0,
		finalSubmissionTriggered: runtimeState.finalSubmissionTriggered === true,
	};
}

function stateForFinalReviewDecision(decision = {}) {
	const action = decision && decision.action || "";
	if (!REVIEW_ALLOWED_ACTIONS[REVIEW_TYPES.FINAL_REVIEW].includes(action)) return "stopped-by-user";
	if (action === "keep-open") return "manual-review-complete";
	if (action === "finish-without-submit") return "finished-without-submit";
	return "stopped-by-user";
}

function attachFinalReview(result, state) {
	return {
		...result,
		finalReview: {
			interactive: true,
			state,
			automatedActionsPerformed: false,
			manualSubmissionOutcome: "unknown",
		},
	};
}

module.exports = {
	AgentController,
};
