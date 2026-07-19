const assert = require("node:assert/strict");

const { buildImprovementProposals } = require("./improvement-proposals");

const greenhouseReport = {
	runId: "run-greenhouse",
	metricsV2: {
		task: {
			status: "needs-review",
			completedFieldCount: 8,
			efficiency: {
				totalActions: 8,
				repeatedFieldAttempts: 0,
				skippedVerifiedFields: 8,
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
		decision: {
			decisionCount: 9,
			actionDecisionCount: 8,
			needsReviewCount: 1,
			policyViolationCount: 0,
		},
	},
	failureReport: {
		failures: [
			{
				area: "Detection",
				rootCause: "Required field cannot be safely matched without a label.",
				suggestedImprovement: "Improve label association and required-field detection using generic semantic context.",
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
				estimatedImpact: "High",
				status: "Open",
			},
		],
	},
};

const proposals = buildImprovementProposals(greenhouseReport, {
	capabilityHistory: {
		records: [
			{ capability: "Field Identification", status: "Open" },
			{ capability: "Field Identification", status: "Proposed" },
			{ capability: "Policy Navigation", status: "Validated" },
		],
	},
});

assert.equal(proposals.schemaVersion, 1);
assert.equal(proposals.mode, "rwvs-improvement-proposals");
assert.equal(proposals.items[0].capability, "Field Identification");
assert.equal(proposals.items[0].title, "Improve generic field identification");
assert.equal(proposals.items[0].expectedImpact, "High");
assert.equal(proposals.items[0].regressionRisk, "Medium");
assert.equal(proposals.items[0].status, "proposed");
assert.equal(proposals.items[0].affectedLayers.includes("Task"), true);
assert.equal(proposals.items[0].evidence.some((item) => item === "reason=required-field-needs-review"), true);
assert.equal(proposals.items[0].evidence.some((item) => item.includes("Required field cannot be safely matched without a label.")), true);
assert.equal(proposals.items[0].candidateTests.some((item) => item.includes("required fields without usable labels")), true);

const rankingReport = {
	runId: "run-ranking",
	metricsV2: {
		task: {
			completedFieldCount: 0,
			efficiency: { repeatedFieldAttempts: 0 },
			outcome: {
				status: "needs-review",
				reason: "low-confidence",
				blockerLayer: "Task",
				blockerCapability: "Semantic Matching",
				safetyOutcome: "safe-stop",
			},
		},
	},
	backlog: {
		items: [
			{
				priority: "P2",
				area: "Detection",
				issue: "Required field cannot be safely matched without a label.",
				suggestedFix: "Improve label association.",
				estimatedImpact: "High",
				status: "Open",
			},
			{
				priority: "P2",
				area: "Reasoning",
				issue: "The agent required human review.",
				suggestedFix: "Improve semantic matching.",
				estimatedImpact: "Medium",
				status: "Open",
			},
		],
	},
};
const ranked = buildImprovementProposals(rankingReport, {
	capabilityHistory: {
		records: [
			{ capability: "Semantic Matching", status: "Open" },
			{ capability: "Semantic Matching", status: "Open" },
			{ capability: "Semantic Matching", status: "Open" },
		],
	},
});
assert.equal(ranked.items[0].capability, "Semantic Matching");

const fixedRepeatedFieldReport = {
	runId: "run-fixed-repeated-field",
	metricsV2: {
		task: {
			completedFieldCount: 8,
			efficiency: {
				totalActions: 8,
				repeatedFieldAttempts: 0,
				skippedVerifiedFields: 8,
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
	backlog: {
		items: [],
	},
};
const fixedRepeatedProposals = buildImprovementProposals(fixedRepeatedFieldReport);
assert.equal(fixedRepeatedProposals.items.some((item) => item.capability === "Runtime State Planning"), false);

const repeatedFieldReport = {
	runId: "run-repeated-field",
	metricsV2: {
		task: {
			completedFieldCount: 2,
			efficiency: {
				totalActions: 4,
				repeatedFieldAttempts: 2,
				redundantActionRatio: 0.5,
			},
			outcome: {
				status: "needs-review",
				reason: "max-progress-stalled",
				blockerLayer: "Task",
				blockerCapability: "Runtime State Planning",
			},
		},
	},
	backlog: {
		items: [],
	},
};
const repeatedFieldProposals = buildImprovementProposals(repeatedFieldReport);
assert.equal(repeatedFieldProposals.items.some((item) => item.capability === "Runtime State Planning"), true);
