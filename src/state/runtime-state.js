const { buildRuntimeStateContract } = require("../contracts/runtime-state");

function createInitialRuntimeState(goal = "") {
	const now = new Date().toISOString();

	return buildRuntimeStateContract({
		schemaVersion: 1,
		goal,
		currentUrl: "",
		currentPageTitle: "",
		currentBrowserState: "initialized",
		detectedForms: [],
		detectedFields: [],
		completedFields: [],
		reviewAnswers: [],
		remainingRequiredFields: [],
		uploadedFiles: [],
		navigationHistory: [],
		completedActions: [],
		safetyMetrics: {
			highRiskFieldsDetected: 0,
			unsafeMatchesRejected: 0,
			incompatibleValuesRejected: 0,
			sensitiveReviewItemsCreated: 0,
			reviewAnswersProvided: 0,
			reviewAnswersApplied: 0,
			unsafeActionsExecuted: 0,
		},
		currentExecutionStatus: "initialized",
		validationErrors: [],
		createdAt: now,
		updatedAt: now,
	});
}

module.exports = {
	createInitialRuntimeState,
};
