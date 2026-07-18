const { createInitialRuntimeState } = require("./runtime-state");
const { assertRuntimeStateContract, assertRuntimeStatePatchContract } = require("../contracts/runtime-state");
const {
	buildObservationStatePatch,
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
