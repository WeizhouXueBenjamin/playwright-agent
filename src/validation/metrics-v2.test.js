const assert = require("node:assert/strict");

const { buildLayeredHealthV2 } = require("./health-score");
const { buildMetricsV2 } = require("./metrics-v2");

const metrics = buildMetricsV2({
	observationReport: {
		summary: {
			detectedFieldCount: 2,
			consoleErrorCount: 1,
			networkErrorCount: 0,
		},
	},
	validationReport: {
		summary: {
			totalDetectedComponents: 3,
			unsupportedComponentCount: 0,
			potentialRiskCount: 1,
		},
		componentValidation: {
			pageProfile: {
				type: "application-entry",
				confidence: 0.78,
			},
			applicableComponents: {
				required: ["application-entry-link", "label-association"],
				optional: ["navigation-button"],
				components: [],
			},
			coverage: {
				coverageRatio: 0.22,
				legacyCoverageRatio: 0.22,
				applicableCoverageRatio: 1,
				requiredApplicableCount: 2,
				presentRequiredApplicableCount: 2,
				missingRequiredApplicableComponents: [],
			},
		},
	},
	executionReport: {
		status: "needs-review",
		humanConfirmationRequired: false,
		stoppedBeforeIrreversibleAction: false,
		summary: {
			executedActionCount: 1,
			recoveryAttemptCount: 0,
			retryCount: 0,
			verificationFailureCount: 0,
			completedFieldCount: 0,
			uploadedFileCount: 0,
		},
		verificationResults: [
			{ ok: true },
		],
		runtimeTimeline: [
			{ remainingRequiredFieldCount: 2 },
			{ remainingRequiredFieldCount: 1 },
		],
		executionTimeline: [
			{
				decision: {
					type: "action",
					policyEvaluation: { status: "allowed", reason: "actionable-decision" },
				},
				action: { verificationOk: true },
			},
			{
				decision: {
					type: "needs-review",
					policyEvaluation: { status: "blocked-or-terminal", reason: "login-required" },
				},
			},
		],
	},
});

assert.equal(metrics.schemaVersion, 1);
assert.equal(metrics.decision.decisionCount, 2);
assert.equal(metrics.decision.actionDecisionCount, 1);
assert.equal(metrics.decision.needsReviewCount, 1);
assert.equal(metrics.decision.policyViolationCount, 0);
assert.equal(metrics.decision.verificationConsistentCount, 1);
assert.equal(metrics.decision.verificationInconsistentCount, 0);
assert.equal(metrics.decision.requiredFieldProgressionScore, 0.5);
assert.equal(metrics.decision.strategyConsistencyScore, 1);
assert.equal(metrics.page.applicableCoverageRatio, 1);
assert.equal(metrics.page.legacyCoverageRatio, 0.22);

const health = buildLayeredHealthV2(metrics);
assert.equal(health.mode, "layered-health-v2");
assert.equal(typeof health.observationHealth.score, "number");
assert.equal(typeof health.decisionHealth.inputs.policyCompliance, "number");
assert.equal(health.benchmarkHealth.inputs.pageHealth, health.pageHealth.score / 100);
