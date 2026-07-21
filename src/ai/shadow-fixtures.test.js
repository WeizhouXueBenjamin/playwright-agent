const assert = require("node:assert/strict");

const { buildObservationV2Contract } = require("../contracts/observation-v2");
const { FixtureSemanticDecisionProvider, ShadowSemanticDecisionProvider } = require("./semantic-decision-provider");
const { buildShadowFixtureDecisions, buildShadowFixtureReport } = require("./shadow-fixtures");

const observationV2 = buildObservationV2Contract({
	observation: {
		schemaVersion: 1,
		fingerprint: "fixture-fingerprint",
		sources: ["dom"],
		semanticPage: {
			url: "https://example.test",
			title: "Fixture",
			summary: {},
			interactiveElements: [{ id: "interactive-1", kind: "text-input", label: { text: "First name", source: "label" } }],
		},
	},
	goal: "Shadow compare",
});

const fixtureDecisions = buildShadowFixtureDecisions(observationV2);
assert.equal(fixtureDecisions.length, 7);

const provider = new ShadowSemanticDecisionProvider(new FixtureSemanticDecisionProvider({
	"first-name": fixtureDecisions[0].decision,
}));
provider.produceSemanticDecision({ decisionContext: { fixtureId: "first-name" } }).then((result) => {
	assert.equal(result.shadowOnly, true);
	assert.equal(result.executable, false);
	assert.equal(result.decision.type, "act");
	const report = buildShadowFixtureReport([{ fixtureId: "first-name", gateResult: "approved-action" }]);
	assert.equal(report.executed, false);
	assert.equal(report.fixtureCount, 1);
	console.log("shadow-fixtures tests passed");
}).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
