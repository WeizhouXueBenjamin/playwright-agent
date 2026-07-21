const { classifyFailure } = require("./failure-classifier");
const { RetryPolicy } = require("./retry-policy");
const {
	backtrack,
	reobserve,
	requestUserConfirmation,
	retrySameAction,
} = require("./recovery-strategies");

class RecoveryEngine {
	constructor(options = {}) {
		this.options = options;
		this.retryPolicy = new RetryPolicy(options.retryPolicy);
	}

	async recover(context) {
		const afterObservation = await reobserve(context.page, context.stateManager);
		const failure = classifyFailure({
			...context,
			afterObservation,
			runtimeState: context.stateManager.getState(),
		});

		if (failure.type === "unexpected-navigation") {
			return this.backtrack(context, failure);
		}

		if (this.retryPolicy.canRetry(failure)) {
			return this.retry(context, failure);
		}

		if (isReplanCandidate(failure)) {
			return {
				status: "recovered",
				strategy: "reobserve-replan",
				failure,
				message: "Fresh browser observation was synchronized; the next loop cycle will re-plan.",
			};
		}

		return requestUserConfirmation(failure);
	}

	async retry(context, failure) {
		const retryAttempt = this.retryPolicy.recordRetry(failure);
		const actionResult = await retrySameAction(context.page, context.step, {
			...this.options,
			runtimeState: context.stateManager.getState(),
			profile: context.profile,
			goal: context.goal,
			history: context.lifecycle,
			stateManager: context.stateManager,
		});
		const observation = await reobserve(context.page, context.stateManager);

		if (actionResult.verification.ok) {
			context.stateManager.applySuccessfulAction(context.step, actionResult.verification);
			return {
				status: "recovered",
				strategy: "retry",
				failure,
				retryAttempt,
				actionResult,
				observationFingerprint: observation.fingerprint,
			};
		}

		return {
			status: "not-recovered",
			strategy: "retry",
			failure,
			retryAttempt,
			actionResult,
		};
	}

	async backtrack(context, failure) {
		const result = await backtrack(context.page, context.stateManager, this.options);
		if (!result.ok) {
			return requestUserConfirmation({
				...failure,
				backtrackError: result.error,
			});
		}

		return {
			status: "recovered",
			strategy: "backtrack",
			failure,
			message: "Browser back navigation succeeded; the next loop cycle will re-plan.",
		};
	}
}

function isReplanCandidate(failure) {
	return [
		"dynamic-page-change",
	].includes(failure.type);
}

module.exports = {
	RecoveryEngine,
};
