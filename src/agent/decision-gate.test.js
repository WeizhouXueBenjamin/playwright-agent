const assert = require("node:assert/strict");

const { buildObservationV2Contract } = require("../contracts/observation-v2");
const { buildCapabilityStep } = require("../capabilities/capability-registry");
const { buildFactId } = require("../profile/profile-facts");
const { adaptLegacyStepToDecisionV2 } = require("./decision-v2-adapter");
const { gateDecisionV2, gateStepForCurrentObservation } = require("./decision-gate");

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
const observationV2 = buildObservationV2Contract({ observation, goal: "Apply safely" });

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
const decision = adaptLegacyStepToDecisionV2({ step, observationV2, goal: "Apply safely" });

async function main() {
	const approved = gateDecisionV2({
		decision,
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: { firstName: "Aroha" },
	});
	assert.equal(approved.type, "approved-action");
	assert.equal(approved.step.provenance.approvalOwner, "decision-gate");

	const inventedTarget = gateDecisionV2({
		decision: { ...decision, decisionId: "decision-target", targetElementId: "missing-field" },
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: { firstName: "Aroha" },
	});
	assert.equal(inventedTarget.type, "rejected-decision");
	assert.equal(inventedTarget.reason, "target-element-not-found");

	const inventedFact = gateDecisionV2({
		decision: { ...decision, decisionId: "decision-fact", selectedProfileFactId: "fact-invented" },
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: { firstName: "Aroha" },
	});
	assert.equal(inventedFact.type, "rejected-decision");
	assert.equal(inventedFact.reason, "profile-fact-not-found");

	const factMismatch = gateDecisionV2({
		decision: {
			...decision,
			decisionId: "decision-mismatch",
			selectedProfileFact: { ...decision.selectedProfileFact, value: "Other" },
		},
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: { firstName: "Aroha" },
	});
	assert.equal(factMismatch.type, "rejected-decision");
	assert.equal(factMismatch.reason, "profile-fact-audit-mismatch");

	const stale = gateDecisionV2({
		decision: { ...decision, decisionId: "decision-stale", observationFingerprint: "old" },
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: { firstName: "Aroha" },
	});
	assert.equal(stale.type, "rejected-decision");
	assert.equal(stale.reason, "stale-observation-fingerprint");

	const unsupported = gateDecisionV2({
		decision: { ...decision, decisionId: "decision-capability", proposedAbstractCapability: "upload-file" },
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: { firstName: "Aroha" },
	});
	assert.equal(unsupported.type, "rejected-decision");
	assert.equal(unsupported.reason, "unsupported-target-capability");

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
	const policyDecision = adaptLegacyStepToDecisionV2({ step: policyStep, observationV2, goal: "Apply safely" });
	const policyBlocked = gateDecisionV2({
		decision: policyDecision,
		observationV2,
		semanticPage,
		runtimeState: {},
		profile: {},
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
		profile: { targetRole: "Engineer" },
		goal: "Apply safely",
	});
	assert.equal(safetyBlocked.type, "review-item");
	assert.equal(safetyBlocked.reason, "sensitive-field-unsafe-profile-match");

	assert.equal(buildFactId("firstName"), decision.selectedProfileFactId);
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
