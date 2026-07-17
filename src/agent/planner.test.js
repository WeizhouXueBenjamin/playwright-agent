const assert = require("node:assert/strict");

const { buildExecutionPlan } = require("./planner");

const matches = [
	createMatch("interactive-1", "text-input", "First name", "firstName", "Aroha", 98),
	createMatch("interactive-2", "checkbox", "I agree", "agreement", true, 90),
	createMatch("interactive-3", "selection", "Country", "country", "New Zealand", 94),
	createMatch("interactive-4", "text-input", "Middle name", null, "", 0),
];

const plan = buildExecutionPlan(matches);

assert.equal(plan.status, "needs-review");
assert.deepEqual(
	plan.steps.map((step) => ({
		action: step.action,
		field: step.field.label.text,
		property: step.profileProperty.path,
		confidence: step.confidenceScore,
	})),
	[
		{ action: "fill-text", field: "First name", property: "firstName", confidence: 98 },
		{ action: "set-checkbox", field: "I agree", property: "agreement", confidence: 90 },
		{ action: "select-option", field: "Country", property: "country", confidence: 94 },
	],
);
assert.deepEqual(plan.reviewItems.map((item) => item.reason), ["unmatched-field"]);

function createMatch(fieldId, kind, label, propertyPath, value, confidenceScore) {
	return {
		field: {
			id: fieldId,
			kind,
			label: { text: label, source: "label", confidence: 0.98 },
			required: false,
			inputType: kind === "checkbox" ? "checkbox" : "",
		},
		matchedProfileProperty: propertyPath
			? {
				path: propertyPath,
				value,
				valueType: typeof value,
				valuePresent: value !== "",
			}
			: null,
		confidenceScore,
		reasoning: propertyPath ? `Matched ${label} to ${propertyPath}.` : "No match.",
	};
}
