function buildDecisionLog(result) {
	return (result.lifecycle || []).map((entry) => {
		const decision = {
			cycle: entry.cycle,
			url: entry.url,
			phase: entry.phase,
			decision: entry.decision,
			terminalState: entry.terminalState,
		};

		if (entry.actionResult) {
			decision.action = {
				type: entry.actionResult.step.action,
				field: entry.actionResult.step.field.label,
				profileProperty: entry.actionResult.step.profileProperty,
				reasoning: entry.actionResult.step.reasoning,
				confidenceScore: entry.actionResult.step.confidenceScore,
				verification: entry.actionResult.verification,
			};
		}

		if (entry.recovery) {
			decision.recovery = entry.recovery;
		}

		return decision;
	});
}

module.exports = {
	buildDecisionLog,
};
