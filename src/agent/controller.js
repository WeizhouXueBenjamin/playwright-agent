const { executeStep } = require("./executor");
const { observePage } = require("./observer");
const { determineNextAction } = require("./next-action");
const { detectTerminalState } = require("./terminal-state");
const { verifyAction } = require("./verifier");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForInteractionStable, waitForPageStable } = require("../browser/stability");
const { RecoveryEngine } = require("../recovery/recovery-engine");
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
			const decision = determineNextAction(observation.semanticPage, profile, {
				...this.options,
				runtimeState: observedRuntimeState,
			});
			const terminalState = detectTerminalState(observation.semanticPage, decision);

			const lifecycleEntry = {
				cycle,
				phase: "observe-think",
				timestamp: new Date().toISOString(),
				url: observation.semanticPage.url,
				pageSummary: observation.semanticPage.summary,
				decision: summarizeDecision(decision),
				terminalState,
				runtimeStateSnapshot: observedRuntimeState,
			};

			if (terminalState.reached) {
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

			const actionResult = await this.actAndVerify(page, decision.step, observation);
			if (actionResult.verification.ok) {
				stateManager.applySuccessfulAction(decision.step, actionResult.verification);
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
					step: decision.step,
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

	async actAndVerify(page, step, observation) {
		let action;

		try {
			action = await executeStep(page, step);
			await waitForInteractionStable(page, this.options.interactionStability);
		} catch (error) {
			return {
				step,
				action: action || null,
				verification: {
					ok: false,
					error: error.message,
				},
			};
		}

		if (step.action === "click") {
			const nextObservation = await observePage(page);
			return {
				step,
				action,
				verification: {
					ok: nextObservation.fingerprint !== observation.fingerprint,
					expected: "page-state-changes-after-click",
					actual: nextObservation.fingerprint === observation.fingerprint ? "unchanged" : "changed",
				},
			};
		}

		return {
			step,
			action,
			verification: await verifyAction(page, step),
		};
	}
}

function summarizeDecision(decision) {
	if (decision.type !== "action") {
		return {
			type: decision.type,
			reason: decision.reason,
		};
	}

	return {
		type: decision.type,
		action: decision.step.action,
		field: decision.step.field.label,
		confidenceScore: decision.step.confidenceScore,
		reasoning: decision.reasoning,
	};
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
