const path = require("node:path");

const { runPartialExecution } = require("../execution/partial-execution-runner");
const { createRunLogDir, writeJsonArtifact } = require("../logging/artifact-store");
const { validateApplicationComponents } = require("../validation/component-validation-runner");
const { buildBenchmarkReport, buildCaseResult } = require("./benchmark-report");
const { loadBenchmarkDataset } = require("./dataset-loader");
const { appendBenchmarkHistory } = require("./history-store");

async function runBenchmark(datasetPath, options = {}) {
	const dataset = await loadBenchmarkDataset(datasetPath);
	const logsDir = options.logsDir || "logs/benchmarks";
	const { runId, runDir } = await createRunLogDir(logsDir);
	const startedAt = new Date().toISOString();
	const caseResults = [];

	for (const benchmarkCase of dataset.cases) {
		const caseResult = await runBenchmarkCase(benchmarkCase, {
			...options,
			runDir,
			logsDir,
		});
		caseResults.push(caseResult);
		await writeJsonArtifact(runDir, `${benchmarkCase.id}-case-report.json`, caseResult);
	}

	const finishedAt = new Date().toISOString();
	const report = buildBenchmarkReport({
		runId,
		dataset,
		startedAt,
		finishedAt,
		caseResults,
		artifacts: {
			runDir,
			benchmarkReport: "benchmark-report.json",
			history: path.join(logsDir, "history.json"),
		},
	});

	await writeJsonArtifact(runDir, "benchmark-report.json", report);
	const historyPath = await appendBenchmarkHistory(logsDir, report);

	return {
		runDir,
		historyPath,
		report,
	};
}

async function runBenchmarkCase(benchmarkCase, options = {}) {
	const startedAt = new Date().toISOString();
	const artifacts = {};
	let validationReport = null;
	let executionReport = null;

	try {
		const validation = await validateApplicationComponents(benchmarkCase.url, {
			...options,
			...(benchmarkCase.options || {}),
			logsDir: path.join(options.runDir, benchmarkCase.id, "component-validation"),
		});
		validationReport = validation.report;
		artifacts.componentValidationDir = validation.runDir;
		artifacts.validationReport = path.join(validation.runDir, validation.report.artifacts.validationReport);
		artifacts.screenshots = [path.join(validation.runDir, validation.report.artifacts.screenshot)];
		artifacts.reasoningLogs = [path.join(validation.runDir, validation.report.artifacts.reasoningLog)];

		const execution = await runPartialExecution({
			url: benchmarkCase.url,
			profile: benchmarkCase.profile,
			resume: benchmarkCase.resume,
			coverLetter: benchmarkCase.coverLetter,
			options: {
				...options,
				...(benchmarkCase.options || {}),
			},
		});
		executionReport = execution.report;
		artifacts.executionReport = `${benchmarkCase.id}-execution-report.json`;
		artifacts.executionReasoningLog = `${benchmarkCase.id}-execution-reasoning-log.json`;
		artifacts.runtimeStateHistory = `${benchmarkCase.id}-runtime-state-history.json`;
		artifacts.reasoningLogs.push(path.join(options.runDir, artifacts.executionReasoningLog));
		await writeJsonArtifact(options.runDir, artifacts.executionReport, executionReport);
		await writeJsonArtifact(options.runDir, artifacts.executionReasoningLog, buildExecutionReasoningLog(executionReport));
		await writeJsonArtifact(options.runDir, artifacts.runtimeStateHistory, executionReport.runtimeTimeline);

		return buildCaseResult({
			benchmarkCase,
			startedAt,
			finishedAt: new Date().toISOString(),
			status: "completed",
			validationReport,
			executionReport,
			artifacts,
		});
	} catch (error) {
		return buildCaseResult({
			benchmarkCase,
			startedAt,
			finishedAt: new Date().toISOString(),
			status: "failed",
			error,
			validationReport,
			executionReport,
			artifacts,
		});
	}
}

function buildExecutionReasoningLog(executionReport) {
	return (executionReport.executionTimeline || []).map((entry) => ({
		cycle: entry.cycle,
		timestamp: entry.timestamp,
		phase: entry.phase,
		url: entry.url,
		decision: entry.decision,
		action: entry.action || null,
		recovery: entry.recovery || null,
		terminalState: entry.terminalState,
	}));
}

module.exports = {
	runBenchmark,
	runBenchmarkCase,
};
