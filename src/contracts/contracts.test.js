const assert = require("node:assert/strict");

const { buildDecisionContract } = require("./decision");
const { buildObservationContract } = require("./observation");
const {
	assertRuntimeStatePatchContract,
	buildRuntimeStateContract,
} = require("./runtime-state");
const { buildVerificationResultContract } = require("./verification-result");

const observation = buildObservationContract({
	semanticPage: {
		url: "https://example.test/apply",
		title: "Application",
		summary: { fieldCount: 1 },
		interactiveElements: [],
	},
	fingerprint: "fingerprint",
});

assert.equal(observation.schemaVersion, 1);
assert.equal(observation.mode, "browser-observation");

const runtimeState = buildRuntimeStateContract({
	schemaVersion: 1,
	goal: "Apply to role",
	currentUrl: "https://example.test/apply",
	currentPageTitle: "Application",
	currentExecutionStatus: "running",
	remainingRequiredFields: [{ id: "first", label: { text: "First name", source: "label" } }],
});

const decision = buildDecisionContract({
	observation,
	runtimeState,
	plannerDecision: {
		type: "action",
		reasoning: "Fill matched profile field.",
		step: {
			action: "fill-text",
			field: { label: { text: "First name", source: "label" } },
			profileProperty: { path: "firstName" },
			confidenceScore: 92,
			verification: { expectedState: "field-value-matches-profile-value" },
		},
	},
	terminalState: { reached: false, status: "running", reason: "actionable-decision" },
});

assert.equal(decision.schemaVersion, 1);
assert.equal(decision.goal, "Apply to role");
assert.equal(decision.reasoning, "Fill matched profile field.");
assert.equal(decision.chosenAction.type, "fill-text");
assert.equal(decision.verificationStrategy.type, "verify-action-result");

const verification = buildVerificationResultContract({
	ok: true,
	expected: "Aroha",
	actual: "Aroha",
	locatorStrategy: "label",
});

assert.equal(verification.schemaVersion, 1);
assert.equal(verification.ok, true);

assert.throws(
	() => assertRuntimeStatePatchContract({ completedFields: [{ confidenceScore: 90 }] }),
	/Runtime State cannot contain/,
);
