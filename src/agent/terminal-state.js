const { evaluatePagePolicy } = require("../policy/policy-engine");

function detectTerminalState(semanticPage, decision) {
	if (decision.type === "needs-review") {
		if (decision.reason === "irreversible-action-needs-confirmation") {
			return {
				reached: true,
				status: "awaiting-human-confirmation",
				reason: decision.reason,
				details: decision.details,
				policyEvaluation: decision.policyEvaluation,
			};
		}

		return {
			reached: true,
			status: "needs-review",
			reason: decision.reason,
			details: decision.details,
		};
	}

	if (decision.type === "none") {
		const policyEvaluation = evaluatePagePolicy(semanticPage);
		if (!policyEvaluation.allowed) {
			return {
				reached: true,
				status: "awaiting-human-confirmation",
				reason: policyEvaluation.reason,
				details: { control: policyEvaluation.control },
				policyEvaluation,
			};
		}

		return {
			reached: true,
			status: "completed",
			reason: "no-actionable-fields-or-navigation",
			details: {},
		};
	}

	return {
		reached: false,
		status: "running",
		reason: "actionable-decision",
		details: {},
	};
}

module.exports = {
	detectTerminalState,
};
