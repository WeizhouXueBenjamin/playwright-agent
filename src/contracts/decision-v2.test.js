const assert = require("node:assert/strict");

const { assertDecisionV2Contract } = require("./decision-v2");

const validDecision = {
	schemaVersion: 2,
	type: "act",
	decisionId: "decision-1",
	observationId: "obs-1",
	observationFingerprint: "fp-1",
	goal: "Apply safely",
	targetElementId: "interactive-1",
	interpretedPageGoal: "complete-field",
	interpretedFieldIntent: "first-name",
	evidenceReferences: [{ type: "label", elementId: "interactive-1", text: "First name" }],
	selectedProfileFactId: "fact-1",
	selectedProfileFact: {
		factId: "fact-1",
		path: "firstName",
		value: "Aroha",
		valueType: "string",
		provenance: "profile",
		scope: "profile",
	},
	proposedAbstractCapability: "text-input",
	proposedValue: "Aroha",
	expectedPostcondition: "field-value-matches-profile-value",
	uncertainty: { level: "low" },
	alternativesConsidered: [],
	reviewRequirement: { required: false, reason: "" },
};

assert.doesNotThrow(() => assertDecisionV2Contract(validDecision));
assert.throws(
	() => assertDecisionV2Contract({ ...validDecision, selector: "#first" }),
	/selector/,
);
assert.throws(
	() => assertDecisionV2Contract({ ...validDecision, javascript: "document.body.click()" }),
	/javascript/,
);
assert.throws(
	() => assertDecisionV2Contract({ ...validDecision, selectedProfileFactId: "" }),
	/selectedProfileFactId/,
);

console.log("decision-v2 contract tests passed");
