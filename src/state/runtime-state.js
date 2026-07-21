const { buildRuntimeStateContract } = require("../contracts/runtime-state");

function createInitialRuntimeState(goal = "") {
	const now = new Date().toISOString();

	return buildRuntimeStateContract({
		schemaVersion: 1,
		goal,
		currentUrl: "",
		currentPageTitle: "",
		detectedFields: [],
		completedFields: [],
		skippedFields: [],
		manualReview: [],
		reviewAnswers: [],
		remainingRequiredFields: [],
		uploadedFiles: [],
		recentActions: [],
		decisionGateResults: [],
		currentExecutionStatus: "initialized",
		status: "initialized",
		validationErrors: [],
		createdAt: now,
		updatedAt: now,
	});
}

module.exports = {
	createInitialRuntimeState,
};
