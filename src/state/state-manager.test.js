const assert = require("node:assert/strict");

const { StateManager } = require("./state-manager");
const { buildReviewAnswer } = require("../review/review-resolution");

const manager = new StateManager("Apply to role");

manager.applyObservation({
	semanticPage: {
		url: "https://example.test/apply",
		title: "Application",
		forms: [
			{
				id: "form-1",
				label: "Application",
				method: "post",
				actionPresent: true,
				controls: ["field-1"],
			},
		],
		interactiveElements: [
			{
				id: "field-1",
				kind: "text-input",
				role: "textbox",
				tagName: "input",
				inputType: "text",
				label: { text: "First name", source: "label", confidence: 0.98 },
				labelCandidates: [{ text: "First name", source: "label", confidence: 0.98 }],
				placeholder: "",
				required: true,
				disabled: false,
				readonly: false,
				state: { value: "" },
				options: [],
				validation: { valid: false, message: "Please fill out this field." },
			},
		],
	},
});

let state = manager.getState();
assert.equal(state.goal, "Apply to role");
assert.equal(state.currentUrl, "https://example.test/apply");
assert.equal(state.detectedFields.length, 1);
assert.equal(state.remainingRequiredFields.length, 1);
assert.equal(state.validationErrors.length, 1);
assert.equal(JSON.stringify(state).includes("confidence"), false);

manager.applySuccessfulAction(
	{
		action: "fill-text",
		field: {
			id: "field-1",
			label: { text: "First name", source: "label", confidence: 0.98 },
		},
		profileProperty: {
			path: "firstName",
		},
	},
	{
		ok: true,
		expected: "Aroha",
		actual: "Aroha",
	},
);

state = manager.getState();
assert.equal(state.recentActions.length, 1);
assert.equal(state.completedFields.length, 1);

const profileBeforeReview = { workAuthorization: "Open work visa valid until 2027" };
const reviewAnswer = buildReviewAnswer({
	fieldIntent: "work-authorization",
	fieldFingerprint: "field-fingerprint-1",
	fieldId: "question-123",
	fieldLabel: { text: "Are you legally authorized to work in New Zealand?", source: "label" },
	answer: "Yes",
	answerType: "selection",
	safetyReasonResolved: "sensitive-field-value-format-mismatch",
	optionsSnapshot: [{ label: "Yes" }, { label: "No" }],
}, new Date("2026-07-20T00:00:00.000Z"));

manager.recordReviewAnswer(reviewAnswer, new Date("2026-07-20T00:00:01.000Z"));

state = manager.getState();
assert.equal(state.reviewAnswers.length, 1);
assert.equal(state.reviewAnswers[0].source, "explicit-user-review");
assert.equal(state.reviewAnswers[0].scope, "current-run");
assert.equal(state.reviewAnswers[0].authorizedAt, "2026-07-20T00:00:00.000Z");
assert.equal(state.reviewAnswers[0].safetyReasonResolved, "sensitive-field-value-format-mismatch");
assert.deepEqual(profileBeforeReview, { workAuthorization: "Open work visa valid until 2027" });
assert.equal(JSON.stringify(state).includes("confidence"), false);
assert.equal(JSON.stringify(state).includes("reasoning"), false);

const consentAnswer = buildReviewAnswer({
	fieldIntent: "privacy-consent",
	fieldFingerprint: "privacy-fingerprint-1",
	fieldId: "privacy",
	fieldLabel: { text: "I agree to the privacy policy", source: "label" },
	answer: "Yes",
	answerType: "selection",
	safetyReasonResolved: "legal-consent-requires-user-review",
	statementFingerprint: "privacy-statement-abc",
}, new Date("2026-07-20T00:00:02.000Z"));

manager.recordReviewAnswer(consentAnswer, new Date("2026-07-20T00:00:03.000Z"));
state = manager.getState();
assert.equal(state.reviewAnswers.find((answer) => answer.fieldIntent === "privacy-consent").statementFingerprint, "privacy-statement-abc");
assert.equal(state.remainingRequiredFields.length, 0);
assert.equal(state.completedFields[0].verifiedValue, "Aroha");
assert.equal(JSON.stringify(state).includes("reasoning"), false);

manager.applySuccessfulAction(
	{
		action: "fill-text",
		field: {
			id: "field-2",
			label: { text: "Last name", source: "label", confidence: 0.98 },
		},
		profileProperty: {
			path: "lastName",
		},
	},
	{
		ok: false,
		expected: "Smith",
		actual: "",
	},
);

state = manager.getState();
assert.equal(state.recentActions.length, 1);
assert.equal(state.completedFields.length, 1);
