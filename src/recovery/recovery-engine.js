const { observePage } = require("../agent/observer");
const { runVerifiedAction } = require("../execution/verified-action-runner");

class RecoveryEngine {
	constructor(options = {}) {
		this.options = options;
	}

	async recover(context) {
		const afterObservation = await reobserve(context.page, context.stateManager);
		const failure = buildFailure(context, afterObservation);
		const retry = await runVerifiedAction({
			page: context.page,
			step: context.step,
			beforeObservation: afterObservation,
			interactionStability: this.options.interactionStability,
		});
		await reobserve(context.page, context.stateManager);

		if (retry.verification.ok) {
			context.stateManager.applySuccessfulAction(context.step, retry.verification);
			return {
				status: "recovered",
				strategy: "retry-once",
				failure,
				retryAttempt: 1,
				actionResult: retry,
			};
		}

		return {
			status: "needs-user-confirmation",
			strategy: "manual-intervention",
			failure,
			retryAttempt: 1,
			actionResult: retry,
			message: "Action failed after re-observe and one retry. User intervention is required.",
		};
	}
}

async function reobserve(page, stateManager) {
	const observation = await observePage(page);
	stateManager.applyObservation(observation);
	return observation;
}

function buildFailure(context, afterObservation) {
	const verification = context.actionResult && context.actionResult.verification || {};
	return {
		type: "action-verification-failed",
		message: verification.reason || verification.error || "Action verification failed.",
		retryKey: `${context.step.action}:${context.step.field.id}`,
		step: {
			action: context.step.action,
			fieldId: context.step.field.id,
			fieldLabel: context.step.field.label,
		},
		verification,
		afterObservationFingerprint: afterObservation && afterObservation.fingerprint || "",
	};
}

module.exports = {
	RecoveryEngine,
};
