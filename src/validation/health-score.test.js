const assert = require("node:assert/strict");

const { buildBenchmarkHealthScore, buildHealthScore } = require("./health-score");

const healthy = buildHealthScore({
	successRate: 1,
	coverage: 1,
	verificationFailures: 0,
	runtimeErrors: 0,
	stoppedBeforeSubmit: true,
});

assert.equal(healthy.score, 100);
assert.equal(healthy.grade, "A");

const degraded = buildHealthScore({
	successRate: 0.5,
	coverage: 0.4,
	verificationFailures: 3,
	runtimeErrors: 2,
	stoppedBeforeSubmit: false,
});

assert.equal(degraded.score < healthy.score, true);
assert.equal(degraded.inputs.stoppedBeforeSubmit, false);

const benchmarkHealth = buildBenchmarkHealthScore({
	successRate: 1,
	averageComponentConfidence: 0.8,
	totalVerificationFailures: 0,
	totalValidationErrors: 1,
});

assert.equal(benchmarkHealth.mode, "validation-health-score");
assert.equal(benchmarkHealth.inputs.coverage, 0.8);
