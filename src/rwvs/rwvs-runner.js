const fs = require("node:fs/promises");
const path = require("node:path");

const { collectObservationBenchmark } = require("../benchmark/benchmark-collector");
const { buildBenchmarkReport, buildCaseResult } = require("../benchmark/benchmark-report");
const { writeJsonArtifact, writeTextArtifact } = require("../logging/artifact-store");
const { runPartialExecution } = require("../execution/partial-execution-runner");
const { validateApplicationComponents } = require("../validation/component-validation-runner");
const { buildImprovementBacklog, buildImprovementSummary } = require("./backlog");
const { buildFailureReport } = require("./failure-analysis");
const { buildBacklogMarkdown, buildBenchmarkMarkdown } = require("./markdown-report");
const { evaluateRegression, loadPreviousRwvsReport } = require("./regression-gate");
const { createWebsiteId } = require("./site-id");

async function runRealWebsiteValidation(input, options = {}) {
	const website = createWebsiteId(input);
	const rootDir = path.resolve(options.rootDir || "benchmark", website);
	const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	const startedAt = new Date().toISOString();
	const dirs = buildDirs(rootDir);
	await createDirs(dirs);

	const context = {
		input,
		options,
		website,
		runId,
		startedAt,
		rootDir,
		dirs,
		observationReport: null,
		validationReport: null,
		executionReport: null,
		phaseFailure: null,
	};

	await runPhase(context, "Observation", runObservationPhase);
	if (!context.phaseFailure) await runPhase(context, "Component Validation", runValidationPhase);
	if (!context.phaseFailure) await runPhase(context, "Partial Execution", runExecutionPhase);

	const failureReport = buildFailureReport(context);
	const backlog = buildImprovementBacklog(failureReport);
	const improvementSummary = buildImprovementSummary(backlog);
	const finishedAt = new Date().toISOString();
	const benchmarkReport = buildRwvsBenchmarkReport(context, failureReport, backlog, improvementSummary, finishedAt);
	const previous = await loadPreviousRwvsReport(dirs.history, runId);
	benchmarkReport.previousMetrics = previous ? previous.metrics : null;
	benchmarkReport.regression = evaluateRegression(benchmarkReport, previous);
	benchmarkReport.result = context.phaseFailure
		? "FAILURE"
		: benchmarkReport.regression.status === "REGRESSION"
			? "REGRESSION"
			: "PASS";

	await writeRwvsArtifacts(context, {
		failureReport,
		backlog,
		improvementSummary,
		benchmarkReport,
	});

	return {
		runId,
		website,
		rootDir,
		result: benchmarkReport.result,
		report: benchmarkReport,
	};
}

async function runPhase(context, phase, fn) {
	try {
		await fn(context);
	} catch (error) {
		context.phaseFailure = {
			phase,
			message: error.message,
			name: error.name,
		};
	}
}

async function runObservationPhase(context) {
	const observation = await collectObservationBenchmark(context.input.url, {
		...context.options,
		...(context.input.options || {}),
		logsDir: context.dirs.observation,
	});
	context.observationReport = observation.report;
	await writeJsonArtifact(context.dirs.reports, "observation-report.json", observation.report);
}

async function runValidationPhase(context) {
	const validation = await validateApplicationComponents(context.input.url, {
		...context.options,
		...(context.input.options || {}),
		logsDir: context.dirs.validation,
	});
	context.validationReport = validation.report;
	await writeJsonArtifact(context.dirs.reports, "validation-report.json", validation.report);
}

async function runExecutionPhase(context) {
	const execution = await runPartialExecution({
		url: context.input.url,
		profile: context.input.profile || {},
		resume: context.input.resume || "",
		coverLetter: context.input.coverLetter || "",
		options: {
			...context.options,
			...(context.input.options || {}),
		},
	});
	context.executionReport = execution.report;
	await writeJsonArtifact(context.dirs.execution, "execution-report.json", execution.report);
	await writeJsonArtifact(context.dirs.execution, "runtime-state-history.json", execution.report.runtimeTimeline);
	await writeJsonArtifact(context.dirs.execution, "action-log.json", execution.report.executedActions);
	await writeJsonArtifact(context.dirs.execution, "execution-reasoning-log.json", execution.report.executionTimeline);
	await writeJsonArtifact(context.dirs.reports, "execution-report.json", execution.report);
}

function buildRwvsBenchmarkReport(context, failureReport, backlog, improvementSummary, finishedAt) {
	const metrics = buildMetrics(context);
	const dataset = {
		name: `rwvs-${context.website}`,
		version: "1",
		sourcePath: "rwvs-input",
		cases: [{
			id: context.website,
			name: context.website,
			tags: ["rwvs"],
		}],
	};
	const caseResult = buildCaseResult({
		benchmarkCase: dataset.cases[0],
		startedAt: context.startedAt,
		finishedAt,
		status: context.phaseFailure ? "failed" : "completed",
		error: context.phaseFailure ? new Error(context.phaseFailure.message) : null,
		validationReport: context.validationReport,
		executionReport: context.executionReport,
		artifacts: {
			observation: context.dirs.observation,
			validation: context.dirs.validation,
			execution: context.dirs.execution,
			reports: context.dirs.reports,
			history: context.dirs.history,
		},
	});
	const benchmark = buildBenchmarkReport({
		runId: context.runId,
		dataset,
		startedAt: context.startedAt,
		finishedAt,
		caseResults: [caseResult],
		artifacts: {
			runDir: context.rootDir,
			benchmarkReport: path.join("reports", "benchmark-report.json"),
			history: context.dirs.history,
		},
	});

	return {
		...benchmark,
		mode: "rwvs",
		website: context.website,
		result: "PENDING",
		metrics,
		failureReport,
		backlog,
		improvementSummary,
		regression: null,
		previousMetrics: null,
	};
}

function buildMetrics(context) {
	const execution = context.executionReport;
	const validation = context.validationReport;
	const observation = context.observationReport;

	return {
		successRate: execution && ["awaiting-human-confirmation", "completed"].includes(execution.status) ? 1 : 0,
		coverage: validation ? validation.summary.coverageRatio : 0,
		executionTimeMs: execution ? calculateExecutionTime(execution.executionTimeline) : 0,
		retries: execution ? execution.summary.retryCount : 0,
		recoveryCount: execution ? execution.summary.recoveryAttemptCount : 0,
		verificationFailures: execution ? execution.summary.verificationFailureCount : 0,
		runtimeErrors: observation
			? observation.summary.consoleErrorCount + observation.summary.networkErrorCount
			: context.phaseFailure ? 1 : 0,
		stoppedBeforeSubmit: execution ? execution.stoppedBeforeIrreversibleAction : false,
	};
}

function calculateExecutionTime(timeline) {
	const timestamps = (timeline || [])
		.map((entry) => entry.timestamp)
		.filter(Boolean)
		.map((timestamp) => new Date(timestamp).getTime())
		.filter((value) => Number.isFinite(value));

	if (timestamps.length < 2) return 0;
	return Math.max(...timestamps) - Math.min(...timestamps);
}

async function writeRwvsArtifacts(context, artifacts) {
	await writeJsonArtifact(context.dirs.reports, "failure-report.json", artifacts.failureReport);
	await writeJsonArtifact(context.dirs.reports, "improvement-summary.json", artifacts.improvementSummary);
	await writeJsonArtifact(context.dirs.reports, "benchmark-report.json", artifacts.benchmarkReport);
	await writeJsonArtifact(context.dirs.reports, "backlog.json", artifacts.backlog);
	await writeTextArtifact(context.dirs.reports, "benchmark.md", buildBenchmarkMarkdown(artifacts.benchmarkReport));
	await writeTextArtifact(context.dirs.reports, "backlog.md", buildBacklogMarkdown(artifacts.backlog));
	await writeJsonArtifact(context.dirs.history, `${context.runId}.json`, artifacts.benchmarkReport);
}

function buildDirs(rootDir) {
	return {
		root: rootDir,
		observation: path.join(rootDir, "observation"),
		validation: path.join(rootDir, "validation"),
		execution: path.join(rootDir, "execution"),
		reports: path.join(rootDir, "reports"),
		history: path.join(rootDir, "history"),
	};
}

async function createDirs(dirs) {
	await Promise.all(Object.values(dirs).map((dir) => fs.mkdir(dir, { recursive: true })));
}

module.exports = {
	runRealWebsiteValidation,
};
