const { executeStep } = require("../agent/executor");
const { observePage } = require("../agent/observer");
const { verifyAction } = require("../agent/verifier");
const { waitForInteractionStable } = require("../browser/stability");
const { buildVerificationFailure, buildVerificationResultContract } = require("../contracts/verification-result");

async function runVerifiedAction(input) {
	const {
		page,
		step,
		beforeObservation,
		interactionStability,
		requireDecisionGate = true,
	} = input;
	let action;

	if (requireDecisionGate && (!step.provenance || step.provenance.approvalOwner !== "decision-gate")) {
		return {
			step,
			action: null,
			verification: buildVerificationFailure(new Error("decision-gate-approval-required")),
		};
	}

	try {
		action = await executeStep(page, step);
		await waitForInteractionStable(page, interactionStability);
	} catch (error) {
		return {
			step,
			action: action || null,
			verification: buildVerificationFailure(error),
		};
	}

	if (step.action === "click" && beforeObservation) {
		const nextObservation = await observePage(page);
		return {
			step,
			action,
			verification: buildVerificationResultContract({
				ok: nextObservation.fingerprint !== beforeObservation.fingerprint,
				expected: "page-state-changes-after-click",
				actual: nextObservation.fingerprint === beforeObservation.fingerprint ? "unchanged" : "changed",
				source: "observation",
			}),
		};
	}

	return {
		step,
		action,
		verification: await verifyAction(page, step),
	};
}

module.exports = {
	runVerifiedAction,
};
