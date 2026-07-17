const { setCheckbox } = require("../actions/checkbox");
const { fillText } = require("../actions/fill");
const { selectOption } = require("../actions/select");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForInteractionStable, waitForPageStable } = require("../browser/stability");
const { verifyAction } = require("./verifier");

async function executePlan(url, plan, options = {}) {
	if (plan.status !== "ready") {
		return {
			status: "blocked",
			reason: "plan-not-ready",
			message: "Execution requires a ready plan with no review items.",
			results: [],
		};
	}

	const browser = await launchChromium({ headless: options.headless });

	try {
		const { context, page } = await openPage(browser, url, options);
		try {
			await waitForPageStable(page, options.stability);
			return await executePlanOnPage(page, plan, options);
		} finally {
			await context.close();
		}
	} finally {
		await browser.close();
	}
}

async function executePlanOnPage(page, plan, options = {}) {
	const results = [];

	for (const step of plan.steps) {
		let actionResult;
		let verification;

		try {
			actionResult = await executeStep(page, step);
			await waitForInteractionStable(page, options.interactionStability);
			verification = await verifyAction(page, step);
		} catch (error) {
			verification = {
				ok: false,
				error: error.message,
			};
		}

		const result = {
			stepId: step.id,
			order: step.order,
			action: step.action,
			field: step.field,
			profileProperty: step.profileProperty,
			actionResult: actionResult || null,
			verification,
		};

		results.push(result);
		if (!verification.ok) {
			return {
				status: "failed",
				failedStepId: step.id,
				results,
			};
		}
	}

	return {
		status: "completed",
		results,
	};
}

async function executeStep(page, step) {
	if (step.action === "fill-text") return fillText(page, step);
	if (step.action === "set-checkbox") return setCheckbox(page, step);
	if (step.action === "select-option") return selectOption(page, step);

	throw new Error(`Unsupported action "${step.action}".`);
}

module.exports = {
	executePlan,
	executePlanOnPage,
};
