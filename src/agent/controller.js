const { executeStep } = require("./executor");
const { observePage } = require("./observer");
const { determineNextAction } = require("./next-action");
const { detectTerminalState } = require("./terminal-state");
const { verifyAction } = require("./verifier");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForInteractionStable, waitForPageStable } = require("../browser/stability");
const { StateManager } = require("../state/state-manager");

class AgentController {
	constructor(options = {}) {
		this.options = {
			maxCycles: 20,
			...options,
		};
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
			const decision = determineNextAction(observation.semanticPage, profile, this.options);
			const terminalState = detectTerminalState(observation.semanticPage, decision);

			const lifecycleEntry = {
				cycle,
				phase: "observe-think",
				url: observation.semanticPage.url,
				pageSummary: observation.semanticPage.summary,
				decision: summarizeDecision(decision),
				terminalState,
			};

			if (terminalState.reached) {
				stateManager.setExecutionStatus(terminalState.status);
				lifecycle.push(lifecycleEntry);
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
				actionResult,
			});

			if (!actionResult.verification.ok) {
				stateManager.setExecutionStatus("verification-failed");
				return {
					status: "verification-failed",
					reason: "action-verification-failed",
					failedCycle: cycle,
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

module.exports = {
	AgentController,
};
