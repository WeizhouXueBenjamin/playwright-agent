const HEALTH_SCORE_SCHEMA_VERSION = 1;

function buildHealthScore(input = {}) {
	const successRate = clampRatio(input.successRate);
	const coverage = clampRatio(input.coverage);
	const verificationReliability = countReliability(input.verificationFailures);
	const runtimeReliability = countReliability(input.runtimeErrors);
	const safety = input.stoppedBeforeSubmit === false ? 0 : 1;
	const score = Math.round(100 * (
		successRate * 0.4
		+ coverage * 0.3
		+ verificationReliability * 0.15
		+ runtimeReliability * 0.1
		+ safety * 0.05
	));

	return {
		schemaVersion: HEALTH_SCORE_SCHEMA_VERSION,
		mode: "validation-health-score",
		score,
		grade: gradeFor(score),
		inputs: {
			successRate,
			coverage,
			verificationFailures: Number(input.verificationFailures || 0),
			runtimeErrors: Number(input.runtimeErrors || 0),
			stoppedBeforeSubmit: input.stoppedBeforeSubmit !== false,
		},
		weights: {
			successRate: 0.4,
			coverage: 0.3,
			verificationReliability: 0.15,
			runtimeReliability: 0.1,
			safety: 0.05,
		},
	};
}

function buildBenchmarkHealthScore(summary) {
	return buildHealthScore({
		successRate: summary.successRate,
		coverage: summary.averageComponentConfidence === null ? 0 : summary.averageComponentConfidence,
		verificationFailures: summary.totalVerificationFailures,
		runtimeErrors: summary.totalValidationErrors,
		stoppedBeforeSubmit: true,
	});
}

function buildLayeredHealthV2(metricsV2 = {}) {
	const layers = metricsV2.layers || metricsV2;
	const observationHealth = scoreLayer(
		"observation-health-v2",
		{
			fieldDetection: layers.observation && layers.observation.detectedFieldCount > 0 ? 1 : 0,
			runtimeReliability: countReliability((layers.observation && layers.observation.consoleErrorCount || 0) + (layers.observation && layers.observation.networkErrorCount || 0)),
			componentSupport: countReliability(layers.observation && layers.observation.unsupportedComponentCount),
		},
		{
			fieldDetection: 0.35,
			runtimeReliability: 0.4,
			componentSupport: 0.25,
		},
	);
	const decisionHealth = scoreLayer(
		"decision-health-v2",
		{
			policyCompliance: ratioFromCounts(layers.decision && layers.decision.policyCompliantCount, layers.decision && layers.decision.policyCompliantCount, layers.decision && layers.decision.policyViolationCount),
			verificationConsistency: ratioFromCounts(layers.decision && layers.decision.verificationConsistentCount, layers.decision && layers.decision.verificationConsistentCount, layers.decision && layers.decision.verificationInconsistentCount),
			requiredFieldProgression: layers.decision ? layers.decision.requiredFieldProgressionScore : 0,
			strategyConsistency: layers.decision ? layers.decision.strategyConsistencyScore : 0,
		},
		{
			policyCompliance: 0.3,
			verificationConsistency: 0.3,
			requiredFieldProgression: 0.2,
			strategyConsistency: 0.2,
		},
	);
	const pageHealth = scoreLayer(
		"page-health-v2",
		{
			profileConfidence: layers.page ? layers.page.pageProfileConfidence : 0,
			applicableCoverage: layers.page ? layers.page.applicableCoverageRatio : 0,
			applicableCompleteness: layers.page && layers.page.requiredApplicableCount
				? layers.page.presentRequiredApplicableCount / layers.page.requiredApplicableCount
				: 1,
		},
		{
			profileConfidence: 0.25,
			applicableCoverage: 0.55,
			applicableCompleteness: 0.2,
		},
	);
	const taskHealth = scoreLayer(
		"task-health-v2",
		{
			taskOutcome: taskOutcomeScore(layers.task && layers.task.status),
			recoveryReliability: countReliability(layers.task && layers.task.recoveryAttemptCount),
			verificationReliability: countReliability(layers.task && layers.task.verificationFailureCount),
			safety: layers.task && layers.task.stoppedBeforeIrreversibleAction ? 1 : 0,
		},
		{
			taskOutcome: 0.35,
			recoveryReliability: 0.2,
			verificationReliability: 0.25,
			safety: 0.2,
		},
	);
	const benchmarkHealth = scoreLayer(
		"benchmark-health-v2",
		{
			observationHealth: observationHealth.score / 100,
			decisionHealth: decisionHealth.score / 100,
			pageHealth: pageHealth.score / 100,
			taskHealth: taskHealth.score / 100,
		},
		{
			observationHealth: 0.2,
			decisionHealth: 0.3,
			pageHealth: 0.25,
			taskHealth: 0.25,
		},
	);

	return {
		schemaVersion: HEALTH_SCORE_SCHEMA_VERSION,
		mode: "layered-health-v2",
		observationHealth,
		decisionHealth,
		pageHealth,
		taskHealth,
		benchmarkHealth,
	};
}

function scoreLayer(mode, inputs, weights) {
	const score = Math.round(100 * Object.entries(weights).reduce((total, [key, weight]) => {
		return total + clampRatio(inputs[key]) * weight;
	}, 0));

	return {
		mode,
		score,
		grade: gradeFor(score),
		inputs,
		weights,
	};
}

function ratioFromCounts(success, successAgain, failure) {
	const numerator = Number(success || 0);
	const denominator = Number(successAgain || 0) + Number(failure || 0);
	if (denominator === 0) return 1;
	return clampRatio(numerator / denominator);
}

function taskOutcomeScore(status) {
	if (status === "completed" || status === "awaiting-human-confirmation") return 1;
	if (status === "needs-review" || status === "needs-user-confirmation") return 0.55;
	if (status === "recovery-failed") return 0.2;
	return 0;
}

function countReliability(count) {
	const value = Number(count || 0);
	if (value <= 0) return 1;
	return Math.max(0, 1 - value / 5);
}

function clampRatio(value) {
	const number = Number(value || 0);
	if (!Number.isFinite(number)) return 0;
	return Math.max(0, Math.min(1, number));
}

function gradeFor(score) {
	if (score >= 90) return "A";
	if (score >= 80) return "B";
	if (score >= 70) return "C";
	if (score >= 60) return "D";
	return "F";
}

module.exports = {
	buildBenchmarkHealthScore,
	buildHealthScore,
	buildLayeredHealthV2,
};
