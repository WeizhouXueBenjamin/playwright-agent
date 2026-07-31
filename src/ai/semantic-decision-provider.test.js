const assert = require("node:assert/strict");

const {
	DisabledSemanticDecisionProvider,
	FixtureSemanticDecisionProvider,
} = require("./semantic-decision-provider");

async function main() {
	const disabled = await new DisabledSemanticDecisionProvider().produceSemanticDecision();
	assert.equal(disabled.status, "disabled");

	const fixture = await new FixtureSemanticDecisionProvider({
		"case-1": {
			action: "select",
			fieldRef: "field-17",
			value: "Work Visa",
			source: "workEligibility.visaType",
			requiresReview: false,
		},
	}).produceSemanticDecision({ decisionContext: { fixtureId: "case-1" } });
	assert.equal(fixture.status, "fixture-decision");
	assert.equal(fixture.decision.source, "workEligibility.visaType");
	assert.notEqual(fixture.status, "codex-semantic");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
