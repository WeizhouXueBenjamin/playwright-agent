const { executeStep } = require("../agent/executor");
const { observePage } = require("../agent/observer");
const { verifyAction } = require("../agent/verifier");
const { gateStepForCurrentObservation } = require("../agent/decision-gate");
const { waitForInteractionStable, waitForPageStable } = require("../browser/stability");

async function retrySameAction(page, step, options = {}) {
	let action = null;

	try {
		const observation = await observePage(page);
		const gateResult = await gateStepForCurrentObservation({
			step,
			observation,
			runtimeState: options.runtimeState || {},
			profile: options.profile || {},
			goal: options.goal || "",
			history: options.history || [],
			semanticOwner: "recovery-logic",
		});
		if (options.stateManager && typeof options.stateManager.recordDecisionGateResult === "function") {
			options.stateManager.recordDecisionGateResult(gateResult);
		}
		if (gateResult.type !== "approved-action") {
			return {
				action,
				gateResult,
				verification: {
					ok: false,
					error: gateResult.reason,
				},
			};
		}
		action = await executeStep(page, gateResult.step);
		await waitForInteractionStable(page, options.interactionStability);
		return {
			action,
			gateResult,
			verification: await verifyAction(page, gateResult.step),
		};
	} catch (error) {
		return {
			action,
			verification: {
				ok: false,
				error: error.message,
			},
		};
	}
}

async function reobserve(page, stateManager) {
	const observation = await observePage(page);
	stateManager.applyObservation(observation);
	return observation;
}

async function backtrack(page, stateManager, options = {}) {
	try {
		await page.goBack({ waitUntil: "domcontentloaded", timeout: options.navigationTimeoutMs || 15000 });
		await waitForPageStable(page, options.stability);
		const observation = await observePage(page);
		stateManager.applyObservation(observation);
		return {
			ok: true,
			observation,
		};
	} catch (error) {
		return {
			ok: false,
			error: error.message,
		};
	}
}

function requestUserConfirmation(failure) {
	return {
		status: "needs-user-confirmation",
		strategy: "request-user-confirmation",
		failure,
		message: "Generic recovery could not verify progress. User confirmation is required.",
	};
}

module.exports = {
	backtrack,
	reobserve,
	requestUserConfirmation,
	retrySameAction,
};
