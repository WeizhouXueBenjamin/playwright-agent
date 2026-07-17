function createInitialRuntimeState(goal = "") {
	const now = new Date().toISOString();

	return {
		schemaVersion: 1,
		goal,
		currentUrl: "",
		currentPageTitle: "",
		currentBrowserState: "initialized",
		detectedForms: [],
		detectedFields: [],
		completedFields: [],
		remainingRequiredFields: [],
		uploadedFiles: [],
		navigationHistory: [],
		completedActions: [],
		currentExecutionStatus: "initialized",
		validationErrors: [],
		createdAt: now,
		updatedAt: now,
	};
}

module.exports = {
	createInitialRuntimeState,
};
