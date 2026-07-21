const assert = require("node:assert/strict");

const { buildObservationContract } = require("./observation");
const { buildObservationV2Contract } = require("./observation-v2");

const v1 = buildObservationContract({
	semanticPage: {
		url: "https://example.test/apply",
		title: "Apply",
		summary: { fieldCount: 1 },
		interactiveElements: [
			{
				id: "interactive-1",
				kind: "text-input",
				label: { text: "First name", source: "label", confidence: 0.98 },
				labelCandidates: [{ text: "First name", source: "label", confidence: 0.98 }],
				placeholder: "Given name",
				required: true,
				state: { value: "" },
				evidence: { visibleText: "First name" },
			},
		],
		forms: [{ id: "form-1", label: "Application", controls: ["interactive-1"] }],
	},
	fingerprint: "fingerprint-1",
});

const v2 = buildObservationV2Contract({
	observation: v1,
	goal: "Apply safely",
	runtimeState: {
		currentExecutionStatus: "running",
		completedFields: [],
		remainingRequiredFields: [{ id: "interactive-1" }],
		reviewAnswers: [],
	},
	policySummary: { finalSubmit: "manual" },
	safetySummary: { fieldSafety: "guarded" },
});

assert.equal(v1.schemaVersion, 1);
assert.equal(v2.schemaVersion, 2);
assert.equal(v2.observationFingerprint, "fingerprint-1");
assert.equal(v2.observedElements[0].elementId, "interactive-1");
assert.equal(v2.observedElements[0].label.text, "First name");
assert.equal(v2.observedElements[0].placeholder, "Given name");
assert.deepEqual(v2.observedElements[0].supportedCapabilities, ["fill-text"]);
assert.equal(JSON.stringify(v2).includes("selector"), false);

console.log("observation-v2 contract tests passed");
