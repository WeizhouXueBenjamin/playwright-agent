const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const {
	CAPABILITY_TAXONOMY,
	buildCapabilitySummary,
	updateCapabilityEvolutionArtifacts,
} = require("./capability-evolution");

async function main() {
	assert.equal(CAPABILITY_TAXONOMY.includes("Policy Navigation"), true);
	assert.equal(CAPABILITY_TAXONOMY.includes("Runtime State Planning"), true);

	const qjumpersSummary = buildCapabilitySummary(createQjumpersReport(), {
		executionReport: {
			executionTimeline: [
				{
					action: {
						type: "click",
						field: { text: "APPLY NOW" },
						verificationOk: true,
					},
				},
			],
		},
	});
	assert.equal(qjumpersSummary.records.some((record) =>
		record.capability === "Policy Navigation"
		&& record.capabilityGap === "Safe Application Entry"
		&& record.status === "Validated"
	), true);

	const greenhouseSummary = buildCapabilitySummary(createGreenhouseReport(), {
		executionReport: {
			executionTimeline: [
				{ action: { type: "fill-text", field: { text: "Country*" }, verificationOk: true } },
				{ action: { type: "fill-text", field: { text: "Location (City)*" }, verificationOk: true } },
			],
		},
	});
	assert.equal(greenhouseSummary.records.some((record) =>
		record.capability === "Runtime State Planning"
		&& record.capabilityGap === "Skip Verified Fields"
		&& record.status === "Validated"
	), true);

	const rootDir = path.join("logs", `test-capability-history-${Date.now()}`);
	await updateCapabilityEvolutionArtifacts(rootDir, createQjumpersReport(), {
		executionReport: {
			executionTimeline: [
				{
					action: {
						type: "click",
						field: { text: "APPLY NOW" },
						verificationOk: true,
					},
				},
			],
		},
	});
	await updateCapabilityEvolutionArtifacts(rootDir, createGreenhouseReport(), {
		executionReport: {
			executionTimeline: [
				{ action: { type: "fill-text", field: { text: "Country*" }, verificationOk: true } },
			],
		},
	});

	const history = JSON.parse(await fs.readFile(path.join(rootDir, "capability-history.json"), "utf8"));
	const markdown = await fs.readFile(path.join(rootDir, "capability-evolution-log.md"), "utf8");
	assert.equal(history.records.some((record) => record.platform === "QJumpers"), true);
	assert.equal(history.records.some((record) => record.platform === "Greenhouse"), true);
	assert.equal(markdown.includes("Safe Application Entry"), true);
	assert.equal(markdown.includes("Skip Verified Fields"), true);
}

function createQjumpersReport() {
	return {
		runId: "run-qjumpers",
		website: "eit-qjumpersjobs-co",
		result: "PASS",
		metricsV2: {
			coverage: { applicableCoverageRatio: 1 },
			pageProfile: { type: "application-entry" },
			task: { status: "needs-review", completedFieldCount: 0 },
			decision: { actionDecisionCount: 1 },
		},
		backlog: { items: [] },
	};
}

function createGreenhouseReport() {
	return {
		runId: "run-greenhouse",
		website: "job-boards-greenhouse-io",
		result: "PASS",
		metricsV2: {
			coverage: { applicableCoverageRatio: 1 },
			pageProfile: { type: "application-form" },
			task: { status: "needs-review", completedFieldCount: 8 },
			decision: { actionDecisionCount: 8 },
		},
		backlog: {
			items: [
				{
					priority: "P2",
					area: "Detection",
					issue: "Required field cannot be safely matched without a label.",
					suggestedFix: "Improve label association and required-field detection using generic semantic context.",
					estimatedImpact: "High",
					status: "Open",
				},
			],
		},
	};
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
