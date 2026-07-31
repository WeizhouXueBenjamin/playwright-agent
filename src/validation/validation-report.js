function buildValidationReport(input) {
	const {
		runId,
		requestedUrl,
		observationReport,
		componentValidation,
		artifacts,
		capturedAt = new Date(),
	} = input;

	return {
		schemaVersion: 1,
		mode: "component-validation",
		zeroSideEffects: true,
		runId,
		requestedUrl,
		finalUrl: observationReport.finalUrl,
		title: observationReport.title,
		capturedAt: capturedAt.toISOString(),
		summary: {
			confidence: componentValidation.confidence,
			totalDetectedComponents: componentValidation.coverage.totalDetectedComponents,
			coverageRatio: componentValidation.coverage.coverageRatio,
			legacyCoverageRatio: componentValidation.coverage.legacyCoverageRatio,
			applicableCoverageRatio: componentValidation.coverage.applicableCoverageRatio,
			missingComponentCount: componentValidation.missingComponents.length,
			unsupportedComponentCount: componentValidation.unsupportedComponents.length,
			potentialRiskCount: componentValidation.potentialRisks.length,
		},
		componentValidation,
		artifacts,
	};
}

module.exports = {
	buildValidationReport,
};
