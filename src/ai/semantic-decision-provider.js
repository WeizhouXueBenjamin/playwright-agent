class DisabledSemanticDecisionProvider {
	async produceSemanticDecision() {
		return {
			status: "disabled",
			decision: null,
		};
	}
}

class FixtureSemanticDecisionProvider {
	constructor(fixtures = {}) {
		this.fixtures = fixtures;
	}

	async produceSemanticDecision({ decisionContext } = {}) {
		const key = decisionContext && decisionContext.fixtureId || "";
		return {
			status: key && this.fixtures[key] ? "fixture-decision" : "no-fixture",
			decision: key && this.fixtures[key] ? structuredClone(this.fixtures[key]) : null,
		};
	}
}

class ShadowSemanticDecisionProvider {
	constructor(provider = new DisabledSemanticDecisionProvider()) {
		this.provider = provider;
	}

	async produceSemanticDecision(input = {}) {
		const result = await this.provider.produceSemanticDecision(input);
		return {
			...result,
			shadowOnly: true,
			executable: false,
		};
	}
}

module.exports = {
	DisabledSemanticDecisionProvider,
	FixtureSemanticDecisionProvider,
	ShadowSemanticDecisionProvider,
};
