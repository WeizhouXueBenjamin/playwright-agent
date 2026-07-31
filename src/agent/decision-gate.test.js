const assert = require("node:assert/strict");

const { buildCapabilityStep } = require("../capabilities/capability-registry");
const { gateStepForCurrentObservation, validateActionProposal } = require("./decision-gate");

const semanticPage = {
	url: "https://example.test/apply",
	title: "Apply",
	summary: {},
	interactiveElements: [
		field("interactive-1", "text-input", "First name"),
		field("interactive-2", "selection", "Country", [{ label: "New Zealand", valuePresent: true, disabled: false }]),
		field("interactive-3", "selection", "Are you legally authorized to work in New Zealand?", [
			{ label: "Yes", valuePresent: true, disabled: false },
			{ label: "No", valuePresent: true, disabled: false },
		]),
		{ ...field("interactive-4", "button", "Submit application"), kind: "button" },
	],
};
const observation = {
	schemaVersion: 1,
	semanticPage,
	fingerprint: "fingerprint-1",
	sources: ["dom"],
};

async function main() {
	const step = buildCapabilityStep({
		id: "step-1",
		order: 1,
		field: semanticPage.interactiveElements[0],
		profileProperty: { path: "firstName", valueType: "string", valuePresent: true },
		actionValue: "Aroha",
		valuePreview: "Aroha",
		confidenceScore: 98,
		reasoning: "Matched first name.",
	});

	const approved = await gateStepForCurrentObservation({
		step,
		observation,
		runtimeState: {},
	});
	assert.equal(approved.type, "approved-action");
	assert.equal(approved.step.provenance.approvalOwner, "decision-gate");
	assert.equal(approved.step.provenance.semanticOwner, "deterministic-semantic-rule");

	const inventedTarget = validateActionProposal({
		action: { ...step, field: { ...step.field, id: "missing-field" } },
		observation,
		runtimeState: {},
	});
	assert.equal(inventedTarget.type, "rejected-decision");
	assert.equal(inventedTarget.reason, "target-element-not-found");

	const completed = validateActionProposal({
		action: step,
		observation,
		runtimeState: {
			completedFields: [{
				fieldId: "interactive-1",
				label: { text: "First name" },
				profilePropertyPath: "firstName",
			}],
		},
	});
	assert.equal(completed.type, "rejected-decision");
	assert.equal(completed.reason, "runtime-state-already-completed");

	const policyStep = buildCapabilityStep({
		id: "step-policy",
		order: 1,
		field: semanticPage.interactiveElements[3],
		profileProperty: { path: "continue", valueType: "boolean", valuePresent: true },
		actionValue: true,
		valuePreview: true,
		confidenceScore: 100,
		reasoning: "Click submit.",
	});
	const policyBlocked = await gateStepForCurrentObservation({
		step: policyStep,
		observation,
		runtimeState: {},
	});
	assert.equal(policyBlocked.type, "rejected-decision");
	assert.equal(policyBlocked.reason, "policy-blocked-action");

	const unsafeWorkAuthStep = buildCapabilityStep({
		id: "step-work-auth",
		order: 1,
		field: semanticPage.interactiveElements[2],
		profileProperty: { path: "targetRole", valueType: "string", valuePresent: true },
		actionValue: "Engineer",
		valuePreview: "Engineer",
		confidenceScore: 100,
		reasoning: "Unsafe match.",
	});
	const safetyBlocked = await gateStepForCurrentObservation({
		step: unsafeWorkAuthStep,
		observation,
		runtimeState: {},
	});
	assert.equal(safetyBlocked.type, "review-item");
	assert.equal(safetyBlocked.reason, "sensitive-field-unsafe-profile-match");
}

function field(id, kind, label, options = []) {
	return {
		id,
		kind,
		label: { text: label, source: "label", confidence: 0.98 },
		labelCandidates: [{ text: label, source: "label", confidence: 0.98 }],
		required: true,
		inputType: "",
		options,
		state: {},
	};
}

main().then(() => {
	console.log("decision-gate tests passed");
}).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
