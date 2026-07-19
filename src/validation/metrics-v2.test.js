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
assert.equal(metrics.task.efficiency.totalActions, 0);
assert.equal(metrics.task.efficiency.repeatedFieldAttempts, 0);
assert.equal(metrics.task.efficiency.skippedVerifiedFields, 0);
assert.equal(metrics.task.efficiency.averageActionsPerCompletedField, 0);
assert.equal(metrics.task.efficiency.redundantActionRatio, 0);
assert.equal(metrics.task.outcome.status, "needs-review");

const health = buildLayeredHealthV2(metrics);
assert.equal(health.mode, "layered-health-v2");
assert.equal(typeof health.observationHealth.score, "number");
assert.equal(typeof health.decisionHealth.inputs.policyCompliance, "number");
assert.equal(health.benchmarkHealth.inputs.pageHealth, health.pageHealth.score / 100);

const repeatedFieldMetrics = buildMetricsV2({
	executionReport: {
		status: "awaiting-human-confirmation",
		executedActions: [
			{
				action: "select-option",
				field: { text: "Country" },
				profileProperty: { path: "country" },
			},
			{
				action: "select-option",
				field: { text: "Country" },
				profileProperty: { path: "country" },
			},
			{
				action: "select-option",
				field: { text: "Country" },
				profileProperty: { path: "country" },
			},
			{
				action: "fill-text",
				field: { text: "City" },
				profileProperty: { path: "city" },
			},
		],
		finalRuntimeState: {
			completedFields: [
				{
					label: { text: "Country" },
					profilePropertyPath: "country",
				},
				{
					label: { text: "City" },
					profilePropertyPath: "city",
				},
			],
		},
	},
});

assert.equal(repeatedFieldMetrics.task.efficiency.totalActions, 4);
assert.equal(repeatedFieldMetrics.task.efficiency.repeatedFieldAttempts, 2);
assert.equal(repeatedFieldMetrics.task.efficiency.skippedVerifiedFields, 1);
assert.equal(repeatedFieldMetrics.task.efficiency.averageActionsPerCompletedField, 2);
assert.equal(repeatedFieldMetrics.task.efficiency.redundantActionRatio, 0.5);

const needsReviewOutcomeMetrics = buildMetricsV2({
	executionReport: {
		status: "needs-review",
		reason: "required-field-needs-review",
		verificationResults: [],
		executionTimeline: [
			{
				terminalState: {
					reached: true,
					status: "needs-review",
					reason: "required-field-needs-review",
				},
			},
		],
		finalRuntimeState: {
			remainingRequiredFields: [
				{ label: { text: "" } },
			],
		},
	},
	failureReport: {
		failures: [
			{
				area: "Detection",
				rootCause: "Required field cannot be safely matched without a label.",
			},
		],
	},
});

assert.equal(needsReviewOutcomeMetrics.task.outcome.status, "needs-review");
assert.equal(needsReviewOutcomeMetrics.task.outcome.reason, "required-field-needs-review");
assert.equal(needsReviewOutcomeMetrics.task.outcome.blockerLayer, "Task");
assert.equal(needsReviewOutcomeMetrics.task.outcome.blockerCapability, "Field Identification");
assert.equal(needsReviewOutcomeMetrics.task.outcome.safetyOutcome, "safe-stop");

const policyStoppedOutcomeMetrics = buildMetricsV2({
	executionReport: {
		status: "awaiting-human-confirmation",
		reason: "irreversible-action-needs-confirmation",
		stoppedBeforeIrreversibleAction: true,
		executionTimeline: [
			{
				terminalState: {
					reached: true,
					status: "awaiting-human-confirmation",
					reason: "irreversible-action-needs-confirmation",
					policyEvaluation: {
						allowed: false,
						status: "requires-confirmation",
						reason: "final-submit",
					},
				},
			},
		],
	},
});

assert.equal(policyStoppedOutcomeMetrics.task.outcome.status, "policy-stopped");
assert.equal(policyStoppedOutcomeMetrics.task.outcome.blockerLayer, "Decision");
assert.equal(policyStoppedOutcomeMetrics.task.outcome.blockerCapability, "Safety / Policy");
assert.equal(policyStoppedOutcomeMetrics.task.outcome.safetyOutcome, "safe-stop");

const maxCyclesOutcomeMetrics = buildMetricsV2({
	executionReport: {
		status: "max-cycles-reached",
		reason: "The autonomous loop reached its configured cycle limit.",
		executionTimeline: [],
		finalRuntimeState: {
			currentExecutionStatus: "max-cycles-reached",
		},
	},
});

assert.equal(maxCyclesOutcomeMetrics.task.outcome.status, "max-cycles");
assert.equal(maxCyclesOutcomeMetrics.task.outcome.blockerLayer, "Task");
assert.equal(maxCyclesOutcomeMetrics.task.outcome.blockerCapability, "Runtime State Planning");
assert.equal(maxCyclesOutcomeMetrics.task.outcome.safetyOutcome, "bounded-stop");
