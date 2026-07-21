const { assertBenchmarkReportContract } = require("../contracts/benchmark-report");

function buildBenchmarkReport(input) {
	const {
		runId,
		dataset,
		startedAt,
		finishedAt,
		caseResults,
		artifacts,
	} = input;
	const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
	const successfulCases = caseResults.filter((result) => result.success);
	const summary = {
		totalCases: caseResults.length,
		successfulCases: successfulCases.length,
		failedCases: caseResults.length - successfulCases.length,
		successRate: caseResults.length ? successfulCases.length / caseResults.length : 0,
		totalExecutionTimeMs: sum(caseResults, (result) => result.executionTimeMs),
		totalActionCount: sum(caseResults, (result) => result.statistics.actionCount),
		totalRetries: sum(caseResults, (result) => result.statistics.retries),
		totalRecoveryCount: sum(caseResults, (result) => result.statistics.recoveryCount),
		totalValidationErrors: sum(caseResults, (result) => result.statistics.validationErrors),
		totalUnsupportedComponents: sum(caseResults, (result) => result.statistics.unsupportedComponents),
		totalVerificationFailures: sum(caseResults, (result) => result.statistics.verificationFailures),
		averageConfidence: average(caseResults.map((result) => result.statistics.confidence).filter((value) => value !== null)),
		averageComponentConfidence: average(caseResults.map((result) => result.statistics.componentConfidence).filter((value) => value !== null)),
		averageActionConfidence: average(caseResults.map((result) => result.statistics.actionConfidence).filter((value) => value !== null)),
	};
	const health = buildLightweightBenchmarkHealth(summary);
	summary.healthScore = health.score;
	summary.healthGrade = health.grade;

	const report = {
		schemaVersion: 1,
		mode: "end-to-end-benchmark",
		runId,
		dataset: {
			name: dataset.name || "",
			version: dataset.version || "",
			sourcePath: dataset.sourcePath,
			caseCount: dataset.cases.length,
		},
		startedAt,
		finishedAt,
		durationMs,
		summary,
		health,
		caseResults,
		artifacts,
	};
	assertBenchmarkReportContract(report);
	return report;
}

function buildCaseResult(input) {
	const {
		benchmarkCase,
		startedAt,
		finishedAt,
		status,
		error,
		validationReport,
		executionReport,
		artifacts,
	} = input;
	const executionTimeMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
	const statistics = buildStatistics(validationReport, executionReport);

	return {
		id: benchmarkCase.id,
		name: benchmarkCase.name,
		tags: benchmarkCase.tags,
		status,
		success: isSuccessful(status, executionReport),
		error: error ? { message: error.message, name: error.name } : null,
		startedAt,
		finishedAt,
		executionTimeMs,
		statistics,
		artifacts,
	};
}

function buildStatistics(validationReport, executionReport) {
	return {
		actionCount: executionReport ? executionReport.summary.executedActionCount : 0,
		retries: executionReport ? executionReport.summary.retryCount : 0,
		recoveryCount: executionReport ? executionReport.summary.recoveryAttemptCount : 0,
		validationErrors: executionReport && executionReport.finalRuntimeState
			? executionReport.finalRuntimeState.validationErrors.length
			: 0,
		unsupportedComponents: validationReport ? validationReport.summary.unsupportedComponentCount : 0,
		confidence: validationReport ? validationReport.summary.confidence : null,
		componentConfidence: validationReport ? validationReport.summary.confidence : null,
		actionConfidence: executionReport ? averageActionConfidence(executionReport.executedActions) : null,
		verificationFailures: executionReport ? executionReport.summary.verificationFailureCount : 0,
		runtimeSnapshotCount: executionReport ? executionReport.summary.runtimeSnapshotCount : 0,
	};
}

function isSuccessful(status, executionReport) {
	if (status !== "completed") return false;
	if (!executionReport) return false;
	return ["awaiting-human-confirmation", "completed"].includes(executionReport.status);
}

function sum(items, selector) {
	return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function average(values) {
	if (!values.length) return null;
	return sum(values, (value) => value) / values.length;
}

function averageActionConfidence(executedActions) {
	const values = (executedActions || [])
		.map((action) => action.confidenceScore)
		.filter((value) => typeof value === "number");
	return average(values);
}

function buildLightweightBenchmarkHealth(summary) {
	const successScore = clamp(summary.successRate);
	const verificationScore = inversePenalty(summary.totalVerificationFailures, summary.totalActionCount);
	const recoveryScore = inversePenalty(summary.totalRecoveryCount, summary.totalActionCount);
	const unsupportedScore = inversePenalty(summary.totalUnsupportedComponents, summary.totalCases);
	const score = Math.round(((successScore * 0.5) + (verificationScore * 0.25) + (recoveryScore * 0.15) + (unsupportedScore * 0.1)) * 100);

	return {
		mode: "lightweight-benchmark-health",
		score,
		grade: grade(score),
		signals: {
			successRate: summary.successRate,
			verificationFailures: summary.totalVerificationFailures,
			recoveryCount: summary.totalRecoveryCount,
			unsupportedComponents: summary.totalUnsupportedComponents,
		},
	};
}

function inversePenalty(count, base) {
	if (!base) return count ? 0 : 1;
	return clamp(1 - (Number(count || 0) / base));
}

function clamp(value) {
	return Math.max(0, Math.min(1, Number(value || 0)));
}

function grade(score) {
	if (score >= 90) return "A";
	if (score >= 75) return "B";
	if (score >= 60) return "C";
	if (score >= 40) return "D";
	return "F";
}

module.exports = {
	buildBenchmarkReport,
	buildCaseResult,
};
