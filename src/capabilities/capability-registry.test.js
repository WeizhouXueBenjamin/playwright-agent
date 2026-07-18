const assert = require("node:assert/strict");

const {
	buildCapabilityStep,
	buildClickCapabilityStep,
	resolveCapabilityForStep,
} = require("./capability-registry");

const textStep = buildCapabilityStep({
	id: "step-1",
	order: 1,
	field: { id: "first", kind: "text-input", label: { text: "First name", source: "label" } },
	profileProperty: { path: "firstName" },
	actionValue: "Aroha",
	valuePreview: "Aroha",
	confidenceScore: 98,
	reasoning: "Matched First name to firstName.",
});

assert.equal(textStep.action, "fill-text");
assert.equal(textStep.capability.name, "text-input");
assert.equal(textStep.capability.intent, "enter-text");
assert.equal(textStep.verification.expectedState, "field-value-matches-profile-value");

const uploadStep = buildCapabilityStep({
	id: "step-2",
	order: 2,
	field: { id: "resume", kind: "file-upload", label: { text: "Resume", source: "label" } },
	actionValue: "resume.pdf",
	valuePreview: "resume.pdf",
	confidenceScore: 95,
	reasoning: "Matched Resume to resumePath.",
});

assert.equal(uploadStep.action, "upload-file");
assert.equal(uploadStep.capability.intent, "upload-file");
assert.equal(uploadStep.verification.expectedState, "uploaded-file-matches-profile-value");

const clickStep = buildClickCapabilityStep({
	id: "nav",
	order: 1,
	field: { id: "continue", kind: "button", label: { text: "Continue", source: "text" } },
	confidenceScore: 1,
	reasoning: "Continue.",
});

assert.equal(clickStep.action, "click");
assert.equal(clickStep.capability.name, "click");
assert.equal(resolveCapabilityForStep({ action: "select-option" }).name, "option-selection");
