const { BrowserAIAgent } = require("../agent/browser-ai-agent");
const { buildExecutionReport } = require("./execution-report");

const PARTIAL_EXECUTION_GOAL = "Partially complete the job application, verify safe actions, and stop before irreversible actions.";

class PartialExecutionRunner {
	constructor(options = {}) {
		this.options = options;
	}

	async run(input) {
		const agent = new BrowserAIAgent({
			...this.options,
			...(input.options || {}),
			goal: PARTIAL_EXECUTION_GOAL,
		});
		const result = await agent.completeJobApplication({
			...input,
			options: {
				...(input.options || {}),
				goal: PARTIAL_EXECUTION_GOAL,
			},
		});

		return {
			...result,
			mode: "partial-execution",
			report: buildExecutionReport(result),
		};
	}
}

async function runPartialExecution(input, options = {}) {
	const runner = new PartialExecutionRunner(options);
	return runner.run(input);
}

module.exports = {
	PARTIAL_EXECUTION_GOAL,
	PartialExecutionRunner,
	runPartialExecution,
};
