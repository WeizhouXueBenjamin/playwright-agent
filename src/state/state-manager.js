const { createInitialRuntimeState } = require("./runtime-state");
const { assertRuntimeStateContract, assertRuntimeStatePatchContract } = require("../contracts/runtime-state");
const {
	buildObservationStatePatch,
	buildDecisionGateStatePatch,
	buildManualCompletionStatePatch,
	buildReviewAnswerStatePatch,
	buildReviewPromptStatePatch,
	buildSkippedFieldStatePatch,
	buildSuccessfulActionStatePatch,
	buildStatusStatePatch,
} = require("./state-update-pipeline");

class StateManager {
	constructor(goal = "") {
		this.state = createInitialRuntimeState(goal);
	}

	applyObservation(observation, date = new Date()) {
		this.applyPatch(buildObservationStatePatch(this.state, observation, date));
		return this.getState();
	}

	applySuccessfulAction(step, verification, date = new Date()) {
		if (!verification || !verification.ok) return this.getState();

		this.applyPatch(buildSuccessfulActionStatePatch(this.state, step, verification, date));
		return this.getState();
	}

	recordReviewPrompt(reviewPrompt, date = new Date()) {
		this.applyPatch(buildReviewPromptStatePatch(this.state, reviewPrompt, date));
		return this.getState();
	}

	recordReviewAnswer(reviewAnswer, date = new Date()) {
		this.applyPatch(buildReviewAnswerStatePatch(this.state, reviewAnswer, date));
		return this.getState();
	}

	recordSkippedField(reviewPrompt, date = new Date()) {
		this.applyPatch(buildSkippedFieldStatePatch(this.state, reviewPrompt, date));
		return this.getState();
	}

	recordManualCompletion(reviewPrompt, date = new Date()) {
		this.applyPatch(buildManualCompletionStatePatch(this.state, reviewPrompt, date));
		return this.getState();
	}

	recordDecisionGateResult(gateResult, date = new Date()) {
		this.applyPatch(buildDecisionGateStatePatch(this.state, gateResult, date));
		return this.getState();
	}

	setExecutionStatus(status, date = new Date()) {
		this.applyPatch(buildStatusStatePatch(status, date));
		return this.getState();
	}

	getState() {
		return structuredClone(this.state);
	}

	applyPatch(patch) {
		assertRuntimeStatePatchContract(patch);
		this.state = {
			...this.state,
			...patch,
			updatedAt: patch.updatedAt || new Date().toISOString(),
		};
		assertRuntimeStateContract(this.state);
	}
}

module.exports = {
	StateManager,
};
