const assert = require("node:assert/strict");

const { StateManager } = require("./state-manager");

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
assert.equal(state.completedActions.length, 1);
assert.equal(state.completedFields.length, 1);
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
assert.equal(state.completedActions.length, 1);
assert.equal(state.completedFields.length, 1);
