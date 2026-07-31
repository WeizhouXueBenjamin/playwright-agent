const assert = require("node:assert/strict");

const { buildExecutionPlan } = require("./planner");
const { normalizeReviewPrompt, formatReviewPrompt } = require("../review/review-resolution");

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

const sensitivePlan = buildExecutionPlan([
	{
		...createMatch("salary", "text-input", "Salary expectations", "targetRole", "Full-Stack Engineer", 98),
		safetyDecision: {
			allowed: false,
			fieldIntent: "salary-expectation",
			riskLevel: "high",
			matchedProperty: "targetRole",
			reason: "sensitive-field-unsafe-profile-match",
			requiresReview: true,
			evidence: [{ source: "label", value: "Salary expectations" }],
		},
	},
]);
assert.equal(sensitivePlan.status, "needs-review");
assert.equal(sensitivePlan.steps.length, 0);
assert.equal(sensitivePlan.reviewItems.length, 1);
assert.equal(sensitivePlan.reviewItems[0].reason, "sensitive-field-unsafe-profile-match");
assert.equal(sensitivePlan.reviewItems[0].safetyDecision.fieldIntent, "salary-expectation");

const salaryPrompt = normalizeReviewPrompt(sensitivePlan.reviewItems[0]);
assert.equal(salaryPrompt.question, "Salary expectations");
assert.equal(salaryPrompt.safetyReason, "sensitive-field-unsafe-profile-match");
assert.equal(formatReviewPrompt(salaryPrompt).includes("The matched profile value is not safe to use"), true);

const optionReviewPlan = buildExecutionPlan([
	{
		...createMatch("work-auth", "radio", "Are you legally authorized to work in New Zealand?", "workAuthorization", "Open work visa", 98),
		field: {
			id: "work-auth",
			kind: "radio",
			label: { text: "Are you legally authorized to work in New Zealand?", source: "label", confidence: 0.98 },
			required: true,
			options: [{ label: "Yes" }, { label: "No" }],
		},
		safetyDecision: {
			allowed: false,
			fieldIntent: "work-authorization",
			riskLevel: "high",
			matchedProperty: "workAuthorization",
			reason: "sensitive-field-value-format-mismatch",
			requiresReview: true,
			evidence: [{ source: "label", value: "Are you legally authorized to work in New Zealand?" }],
		},
	},
]);
const optionPrompt = normalizeReviewPrompt(optionReviewPlan.reviewItems[0]);
assert.deepEqual(optionPrompt.options, [{ label: "Yes" }, { label: "No" }]);
assert.equal(formatReviewPrompt(optionPrompt).includes("- Yes"), true);

const unlabeledPrompt = normalizeReviewPrompt({
	field: {
		id: "unlabeled",
		kind: "text-input",
		label: { text: "", source: "none" },
		required: true,
		options: [],
	},
	reason: "unmatched-field",
});
assert.equal(unlabeledPrompt.question, "This required field has no visible label. Please provide the exact answer to continue.");

const explicitSensitivePlan = buildExecutionPlan([
	{
		...createMatch("salary", "text-input", "Salary expectations", "salaryExpectation", "NZD 150,000", 98),
		safetyDecision: {
			allowed: true,
			fieldIntent: "salary-expectation",
			riskLevel: "high",
			matchedProperty: "salaryExpectation",
			reason: "explicit-profile-value-approved",
			requiresReview: false,
			evidence: [{ source: "label", value: "Salary expectations" }],
		},
	},
]);
assert.equal(explicitSensitivePlan.status, "ready");
assert.equal(explicitSensitivePlan.steps.length, 1);
assert.equal(explicitSensitivePlan.steps[0].profileProperty.path, "salaryExpectation");
assert.equal(explicitSensitivePlan.steps[0].safetyDecision.allowed, true);

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
