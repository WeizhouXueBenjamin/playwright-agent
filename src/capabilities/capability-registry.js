const { setCheckbox } = require("../actions/checkbox");
const { clickElement } = require("../actions/click");
const { fillText } = require("../actions/fill");
const { selectOption } = require("../actions/select");
const { uploadFile } = require("../actions/upload");

const CAPABILITIES = [
	{
		name: "text-input",
		action: "fill-text",
		intent: "enter-text",
		expectedState: "field-value-matches-profile-value",
		supportsField: (field) => field.kind === "text-input" || field.kind === "editable",
		execute: fillText,
	},
	{
		name: "checkbox",
		action: "set-checkbox",
		intent: "set-boolean-state",
		expectedState: "checked-state-matches-profile-value",
		supportsField: (field) => field.kind === "checkbox",
		execute: setCheckbox,
	},
	{
		name: "option-selection",
		action: "select-option",
		intent: "choose-option",
		expectedState: "selected-option-matches-profile-value",
		supportsField: (field) => field.kind === "radio" || field.kind === "selection",
		execute: selectOption,
	},
	{
		name: "file-upload",
		action: "upload-file",
		intent: "upload-file",
		expectedState: "uploaded-file-matches-profile-value",
		supportsField: (field) => field.kind === "file-upload",
		execute: uploadFile,
	},
	{
		name: "click",
		action: "click",
		intent: "activate-control",
		expectedState: "page-state-changes-after-click",
		supportsField: (field) => field.kind === "button" || field.kind === "link",
		execute: clickElement,
	},
];

function buildCapabilityStep(input) {
	const {
		id,
		order,
		field,
		profileProperty = null,
		actionValue,
		valuePreview,
		confidenceScore,
		reasoning,
	} = input;
	const capability = resolveCapabilityForField(field);

	return {
		id,
		order,
		action: capability.action,
		capability: {
			name: capability.name,
			intent: capability.intent,
		},
		field,
		profileProperty,
		actionValue,
		valuePreview,
		confidenceScore,
		reasoning,
		verification: {
			expectedState: capability.expectedState,
			required: true,
		},
	};
}

function buildClickCapabilityStep(input) {
	return buildCapabilityStep({
		...input,
		field: {
			...input.field,
			kind: input.field.kind || "button",
		},
		actionValue: Object.prototype.hasOwnProperty.call(input, "actionValue") ? input.actionValue : true,
		valuePreview: Object.prototype.hasOwnProperty.call(input, "valuePreview") ? input.valuePreview : true,
		profileProperty: input.profileProperty || null,
	});
}

function resolveCapabilityForField(field) {
	const capability = CAPABILITIES.find((candidate) => candidate.supportsField(field || {}));
	if (capability) return capability;
	return CAPABILITIES[0];
}

async function executeCapability(page, step) {
	const capability = resolveCapabilityForStep(step);
	return capability.execute(page, step);
}

function resolveCapabilityForStep(step) {
	const capabilityName = step.capability && step.capability.name;
	const capability = CAPABILITIES.find((candidate) => {
		return candidate.name === capabilityName || candidate.action === step.action;
	});

	if (!capability) {
		throw new Error(`Unsupported action "${step.action}".`);
	}

	return capability;
}

module.exports = {
	buildCapabilityStep,
	buildClickCapabilityStep,
	executeCapability,
	resolveCapabilityForField,
	resolveCapabilityForStep,
};
