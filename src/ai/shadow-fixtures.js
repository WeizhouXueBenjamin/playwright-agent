const { buildBaseDecision } = require("../contracts/decision-v2");

const LOW_RISK_FIXTURE_INTENTS = [
	{ fixtureId: "first-name", label: "First name", path: "firstName", value: "Aroha", intent: "first-name", capability: "text-input" },
	{ fixtureId: "email", label: "Email", path: "email", value: "aroha@example.com", intent: "email", capability: "text-input" },
	{ fixtureId: "phone", label: "Phone", path: "phone", value: "+64 21 000 000", intent: "phone", capability: "text-input" },
	{ fixtureId: "city", label: "City", path: "location.city", value: "Wellington", intent: "city", capability: "text-input" },
	{ fixtureId: "country", label: "Country", path: "location.country", value: "New Zealand", intent: "country", capability: "option-selection" },
	{ fixtureId: "school", label: "School", path: "education.0.school", value: "Victoria University of Wellington", intent: "school", capability: "text-input" },
	{ fixtureId: "degree", label: "Degree", path: "education.0.degree", value: "Bachelor of Commerce", intent: "degree", capability: "text-input" },
];

function buildShadowFixtureDecisions(observationV2) {
	const firstElement = (observationV2.observedElements || [])[0] || { elementId: "fixture-element" };
	return LOW_RISK_FIXTURE_INTENTS.map((fixture) => ({
		fixtureId: fixture.fixtureId,
		decision: {
			...buildBaseDecision({
				decisionId: `shadow-${fixture.fixtureId}`,
				observationId: observationV2.observationId,
				observationFingerprint: observationV2.observationFingerprint,
				goal: observationV2.taskGoal || "shadow fixture",
				semanticOwner: "ai",
			}),
			type: "act",
			targetElementId: firstElement.elementId,
			interpretedPageGoal: "complete-field",
			interpretedFieldIntent: fixture.intent,
			evidenceReferences: [{ type: "fixture", elementId: firstElement.elementId, text: fixture.label }],
			selectedProfileFactId: `fixture-fact-${fixture.fixtureId}`,
			selectedProfileFact: {
				factId: `fixture-fact-${fixture.fixtureId}`,
				path: fixture.path,
				value: fixture.value,
				valueType: "string",
				provenance: "fixture",
				explicitness: "explicit",
				scope: "fixture",
				freshness: "",
				valuePresent: true,
			},
			proposedAbstractCapability: fixture.capability,
			proposedValue: fixture.value,
			expectedPostcondition: fixture.capability === "option-selection"
				? "selected-option-matches-profile-value"
				: "field-value-matches-profile-value",
			uncertainty: { level: "low" },
			alternativesConsidered: [],
			reviewRequirement: { required: false, reason: "" },
		},
	}));
}

function buildShadowFixtureReport(results = []) {
	return {
		mode: "shadow-ai-fixtures",
		executed: false,
		fixtureCount: results.length,
		results: results.map((result) => ({
			fixtureId: result.fixtureId,
			selectedTargetMatched: Boolean(result.selectedTargetMatched),
			interpretedIntentMatched: Boolean(result.interpretedIntentMatched),
			selectedFactMatched: Boolean(result.selectedFactMatched),
			proposedCapabilityMatched: Boolean(result.proposedCapabilityMatched),
			expectedPostconditionMatched: Boolean(result.expectedPostconditionMatched),
			reviewChoiceMatched: Boolean(result.reviewChoiceMatched),
			gateResult: result.gateResult,
		})),
	};
}

module.exports = {
	LOW_RISK_FIXTURE_INTENTS,
	buildShadowFixtureDecisions,
	buildShadowFixtureReport,
};
