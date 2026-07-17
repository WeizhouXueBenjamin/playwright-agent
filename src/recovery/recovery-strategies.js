const { executeStep } = require("../agent/executor");
const { observePage } = require("../agent/observer");
const { verifyAction } = require("../agent/verifier");
const { waitForInteractionStable, waitForPageStable } = require("../browser/stability");

async function retrySameAction(page, step, options = {}) {
	let action = null;

	try {
		action = await executeStep(page, step);
		await waitForInteractionStable(page, options.interactionStability);
		return {
			action,
			verification: await verifyAction(page, step),
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
