const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForInteractionStable, waitForPageStable } = require("../browser/stability");
const { executeCapability } = require("../capabilities/capability-registry");
const { buildVerificationFailure } = require("../contracts/verification-result");
const { observePage } = require("./observer");
const { gateStepForCurrentObservation } = require("./decision-gate");
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
		const observation = await observePage(page);
		const gateResult = await gateStepForCurrentObservation({
			step,
			observation,
			runtimeState: options.runtimeState || {},
			profile: options.profile || {},
			goal: options.goal || "",
			history: results,
			semanticOwner: "deterministic-semantic-rule",
		});

		if (gateResult.type !== "approved-action") {
			results.push({
				stepId: step.id,
				order: step.order,
				action: step.action,
				field: step.field,
				profileProperty: step.profileProperty,
				decisionGate: summarizeGateResult(gateResult),
				actionResult: null,
				verification: {
					ok: false,
					error: gateResult.reason,
				},
			});
			return {
				status: gateResult.type === "review-item" ? "needs-review" : "rejected",
				failedStepId: step.id,
				reason: gateResult.reason,
				results,
			};
		}
		const gatedStep = gateResult.step;

		try {
			actionResult = await executeStep(page, gatedStep);
			await waitForInteractionStable(page, options.interactionStability);
			verification = await verifyAction(page, gatedStep);
		} catch (error) {
			verification = buildVerificationFailure(error);
		}

		const result = {
			stepId: step.id,
			order: step.order,
			action: gatedStep.action,
			field: gatedStep.field,
			profileProperty: gatedStep.profileProperty,
			decisionGate: summarizeGateResult(gateResult),
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
	if (!step || !step.provenance || step.provenance.approvalOwner !== "decision-gate") {
		throw new Error("decision-gate-approval-required");
	}
	return executeCapability(page, step);
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
	executeStep,
	executePlan,
	executePlanOnPage,
};
