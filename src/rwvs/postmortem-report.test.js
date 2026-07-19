const assert = require("node:assert/strict");

const { buildPostmortemMarkdown } = require("./markdown-report");

const markdown = buildPostmortemMarkdown({
	website: "job-boards-greenhouse-io",
	runId: "run-test",
	finishedAt: "2026-07-19T00:00:00.000Z",
	result: "PASS",
	metrics: {
		successRate: 0,
		coverage: 0.78,
		healthScore: 42,
		healthGrade: "F",
	},
	regression: {
		status: "PASS",
		regressions: [],
	},
	metricsV2: {
		pageProfile: {
			type: "application-form",
			confidence: 0.82,
			signals: {
				interactiveElementCount: 52,
				formControlCount: 29,
				applicationEntryCount: 0,
			},
			evidence: ["29 form controls detected"],
		},
		applicableComponents: {
			required: ["text-input", "required-field", "label-association"],
			optional: ["upload", "navigation-button"],
		},
		coverage: {
			legacyCoverageRatio: 0.78,
			applicableCoverageRatio: 1,
		},
		decision: {
			decisionCount: 9,
			actionDecisionCount: 8,
			needsReviewCount: 1,
			policyCompliantCount: 9,
			policyViolationCount: 0,
			verificationConsistentCount: 8,
			verificationInconsistentCount: 0,
			requiredFieldProgressionScore: 0.19,
			strategyConsistencyScore: 1,
		},
		task: {
			status: "needs-review",
			executedActionCount: 8,
			completedFieldCount: 8,
			efficiency: {
				totalActions: 8,
				repeatedFieldAttempts: 0,
				skippedVerifiedFields: 8,
				averageActionsPerCompletedField: 1,
				redundantActionRatio: 0,
			},
			outcome: {
				status: "needs-review",
				reason: "required-field-needs-review",
				blockerLayer: "Task",
				blockerCapability: "Field Identification",
				safetyOutcome: "safe-stop",
			},
		},
	},
	healthV2: {
		observationHealth: { score: 76, grade: "C", inputs: { runtimeReliability: 0.4 } },
		decisionHealth: { score: 84, grade: "B", inputs: { requiredFieldProgression: 0.19 } },
		pageHealth: { score: 96, grade: "A", inputs: { applicableCoverage: 1 } },
		taskHealth: { score: 64, grade: "D", inputs: { taskOutcome: 0.55 } },
		benchmarkHealth: { score: 80, grade: "B", inputs: { taskHealth: 0.64 } },
	},
	failureReport: {
		failures: [
			{
				area: "Detection",
				rootCause: "Required field cannot be safely matched without a label.",
				impact: "High-risk component interpretation may cause incorrect planning.",
			},
		],
	},
	backlog: {
		items: [
			{
				priority: "P2",
				area: "Detection",
				issue: "Required field cannot be safely matched without a label.",
				suggestedFix: "Improve label association and required-field detection using generic semantic context.",
				status: "Open",
			},
		],
	},
}, {
	executionReport: {
		executionTimeline: [
			{
				terminalState: {
					reached: true,
					status: "needs-review",
					reason: "required-field-needs-review",
				},
			},
		],
	},
});

assert.equal(markdown.includes("# RWVS Post-mortem"), true);
assert.equal(markdown.includes("## Task Summary"), true);
assert.equal(markdown.includes("## V1 Result"), true);
assert.equal(markdown.includes("## V2 Layer Diagnosis"), true);
assert.equal(markdown.includes("## Blocking Issue"), true);
assert.equal(markdown.includes("Field Identification"), true);
assert.equal(markdown.includes("Required field cannot be safely matched without a label."), true);
assert.equal(markdown.includes("Improve label association and required-field detection using generic semantic context."), true);
assert.equal(markdown.includes("## Regression Replay Result"), true);
