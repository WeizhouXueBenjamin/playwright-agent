const { buildDecisionContract } = require("../contracts/decision");
const { determineNextAction } = require("./next-action");
const { detectTerminalState } = require("./terminal-state");

function runDecisionCycle(input) {
	const {
		goal = "",
		observation,
		profile,
		runtimeState,
		options = {},
	} = input;

	const plannerDecision = determineNextAction(observation.semanticPage, profile, {
		...options,
		runtimeState,
	});
	const terminalState = detectTerminalState(observation.semanticPage, plannerDecision);
	const decision = buildDecisionContract({
		goal,
		observation,
		runtimeState,
		plannerDecision,
		terminalState,
	});

	return {
		plannerDecision,
		terminalState,
		decision,
	};
}

module.exports = {
	runDecisionCycle,
};
