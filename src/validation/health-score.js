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
};
