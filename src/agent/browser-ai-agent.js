const { AgentController } = require("./controller");
const { buildDecisionLog } = require("./decision-log");
const { buildApplicationProfile } = require("../profile/application-input");

const JOB_APPLICATION_GOAL = "Complete the job application and stop before final submission.";

class BrowserAIAgent {
	constructor(options = {}) {
		this.options = options;
	}

	async completeJobApplication(input) {
		const profile = buildApplicationProfile(input);
		const controller = new AgentController({
			goal: JOB_APPLICATION_GOAL,
			...this.options,
			...(input.options || {}),
		});
		const result = await controller.run(input.url, profile);

		return {
			goal: JOB_APPLICATION_GOAL,
			status: result.status,
			reason: result.reason,
			runtimeState: result.runtimeState,
			decisionLog: buildDecisionLog(result),
			lifecycle: result.lifecycle,
		};
	}
}

module.exports = {
	BrowserAIAgent,
	JOB_APPLICATION_GOAL,
};
