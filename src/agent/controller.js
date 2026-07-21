const { observePage } = require("./observer");
const { runDecisionCycle } = require("./decision-cycle");
const { launchChromium, launchPersistentChromiumContext } = require("../browser/browser");
const { openPage, openPageInContext } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { runVerifiedAction } = require("../execution/verified-action-runner");
const { RecoveryEngine } = require("../recovery/recovery-engine");
const { buildReviewAnswer, formatReviewPrompt, normalizeReviewPrompt } = require("../review/review-resolution");
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
				if (terminalState.status === "needs-review") {
					const reviewPrompt = normalizeReviewPrompt(terminalState.details || {});
					stateManager.recordReviewPrompt(reviewPrompt);
					const promptedState = stateManager.getState();
					const promptedLifecycleEntry = {
						...lifecycleEntry,
						reviewPrompt,
						reviewPromptText: formatReviewPrompt(reviewPrompt),
						runtimeStateSnapshot: promptedState,
					};

					if (typeof this.options.reviewAnswerProvider === "function") {
						const providedAnswer = await this.options.reviewAnswerProvider({
							reviewPrompt,
							reviewItem: terminalState.details || {},
							runtimeState: promptedState,
							page,
						});
						if (providedAnswer !== undefined && providedAnswer !== null) {
							const reviewAnswer = buildReviewAnswer({
								...(typeof providedAnswer === "object" && !Array.isArray(providedAnswer)
									? providedAnswer
									: { answer: providedAnswer }),
								reviewPrompt,
								reviewItem: terminalState.details || {},
							});
							stateManager.recordReviewAnswer(reviewAnswer);
							lifecycle.push({
								...promptedLifecycleEntry,
								phase: "observe-think-review-resolved",
								reviewAnswer: {
									fieldIntent: reviewAnswer.fieldIntent,
									fieldFingerprint: reviewAnswer.fieldFingerprint,
									source: reviewAnswer.source,
									scope: reviewAnswer.scope,
									authorizedAt: reviewAnswer.authorizedAt,
									safetyReasonResolved: reviewAnswer.safetyReasonResolved,
								},
								runtimeStateSnapshot: stateManager.getState(),
							});
							continue;
						}
					}

					stateManager.setExecutionStatus(terminalState.status);
					lifecycle.push({
						...promptedLifecycleEntry,
						runtimeStateSnapshot: stateManager.getState(),
					});
					return {
						status: terminalState.status,
						reason: terminalState.reason,
						reviewPrompt,
						reviewPromptText: formatReviewPrompt(reviewPrompt),
						runtimeState: stateManager.getState(),
						lifecycle,
					};
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

			const actionResult = await runVerifiedAction({
				page,
				step: plannerDecision.step,
				beforeObservation: observation,
				interactionStability: this.options.interactionStability,
			});
			if (actionResult.verification.ok) {
				stateManager.applySuccessfulAction(plannerDecision.step, actionResult.verification);
			}
			lifecycle.push({
				...lifecycleEntry,
				phase: "observe-think-act-verify",
				timestamp: new Date().toISOString(),
				actionResult,
				runtimeStateSnapshot: stateManager.getState(),
			});

			if (!actionResult.verification.ok) {
				const recovery = await this.recoveryEngine.recover({
					page,
					profile,
					step: plannerDecision.step,
					actionResult,
					beforeObservation: observation,
					stateManager,
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

module.exports = {
	AgentController,
};
