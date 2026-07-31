function buildObservationReport(input) {
	const {
		runId,
		requestedUrl,
		finalUrl,
		title,
		stability,
		runtimeState,
		reasoningLog,
		diagnostics,
		artifacts,
		capturedAt = new Date(),
	} = input;

	return {
		schemaVersion: 1,
		mode: "observation",
		zeroSideEffects: true,
		runId,
		requestedUrl,
		finalUrl,
		title,
		capturedAt: capturedAt.toISOString(),
		stability,
		summary: {
			detectedFormCount: Array.isArray(runtimeState.detectedForms) ? runtimeState.detectedForms.length : 0,
			detectedFieldCount: (runtimeState.detectedFields || []).length,
			requiredFieldCount: (runtimeState.remainingRequiredFields || []).length,
			consoleErrorCount: (diagnostics.consoleErrors || []).length,
			networkErrorCount: (diagnostics.networkErrors || []).length,
			reasoningEventCount: (reasoningLog || []).length,
		},
		artifacts,
	};
}

module.exports = {
	buildObservationReport,
};
