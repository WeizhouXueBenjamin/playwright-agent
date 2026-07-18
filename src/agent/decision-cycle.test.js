const assert = require("node:assert/strict");

const { runDecisionCycle } = require("./decision-cycle");

const observation = {
	schemaVersion: 1,
	mode: "browser-observation",
	fingerprint: "page-1",
	sources: ["dom"],
	semanticPage: {
		url: "https://example.test/apply",
		title: "Application",
		summary: { fieldCount: 1 },
		forms: [],
		interactiveElements: [
			{
				id: "first",
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
				validation: { valid: true, message: "" },
			},
		],
	},
};

const runtimeState = {
	schemaVersion: 1,
	goal: "Apply to role",
	currentUrl: "https://example.test/apply",
	currentPageTitle: "Application",
	currentExecutionStatus: "running",
	remainingRequiredFields: [{ id: "first", label: { text: "First name", source: "label" } }],
};

const cycle = runDecisionCycle({
	goal: "Apply to role",
	observation,
	profile: { firstName: "Aroha" },
	runtimeState,
	options: {},
});

assert.equal(cycle.plannerDecision.type, "action");
assert.equal(cycle.plannerDecision.step.action, "fill-text");
assert.equal(cycle.terminalState.reached, false);
assert.equal(cycle.decision.schemaVersion, 1);
assert.equal(cycle.decision.goal, "Apply to role");
assert.equal(cycle.decision.chosenAction.type, "fill-text");
assert.equal(cycle.decision.supportingEvidence.url, "https://example.test/apply");

const submitOnlyCycle = runDecisionCycle({
	goal: "Apply to role",
	observation: {
		...observation,
		semanticPage: {
			...observation.semanticPage,
			interactiveElements: [
				{
					id: "submit",
					kind: "button",
					role: "button",
					label: { text: "Submit application", source: "text", confidence: 1 },
					disabled: false,
				},
			],
		},
	},
	profile: {},
	runtimeState: {
		...runtimeState,
		remainingRequiredFields: [],
	},
	options: {},
});

assert.equal(submitOnlyCycle.plannerDecision.type, "none");
assert.equal(submitOnlyCycle.terminalState.status, "awaiting-human-confirmation");
assert.equal(submitOnlyCycle.decision.riskAssessment.level, "high");
