const fs = require("node:fs/promises");

async function compareBenchmarkReportFiles(leftPath, rightPath) {
	const [left, right] = await Promise.all([
		readReport(leftPath),
		readReport(rightPath),
	]);

	return compareBenchmarkReports(left, right);
}

function compareBenchmarkReports(baseline, candidate) {
	const baselineCases = new Map((baseline.caseResults || []).map((result) => [result.id, result]));
	const candidateCases = new Map((candidate.caseResults || []).map((result) => [result.id, result]));
	const caseIds = [...new Set([...baselineCases.keys(), ...candidateCases.keys()])].sort();

	return {
		schemaVersion: 1,
		mode: "benchmark-comparison",
		baseline: summarizeRun(baseline),
		candidate: summarizeRun(candidate),
		delta: {
			successfulCases: candidate.summary.successfulCases - baseline.summary.successfulCases,
			failedCases: candidate.summary.failedCases - baseline.summary.failedCases,
			successRate: candidate.summary.successRate - baseline.summary.successRate,
			durationMs: candidate.durationMs - baseline.durationMs,
			actionCount: candidate.summary.totalActionCount - baseline.summary.totalActionCount,
			retries: candidate.summary.totalRetries - baseline.summary.totalRetries,
			recoveryCount: candidate.summary.totalRecoveryCount - baseline.summary.totalRecoveryCount,
			unsupportedComponents: candidate.summary.totalUnsupportedComponents - baseline.summary.totalUnsupportedComponents,
			averageConfidence: deltaNullable(candidate.summary.averageConfidence, baseline.summary.averageConfidence),
			averageComponentConfidence: deltaNullable(candidate.summary.averageComponentConfidence, baseline.summary.averageComponentConfidence),
			averageActionConfidence: deltaNullable(candidate.summary.averageActionConfidence, baseline.summary.averageActionConfidence),
		},
		cases: caseIds.map((caseId) => compareCase(caseId, baselineCases.get(caseId), candidateCases.get(caseId))),
	};
}

async function readReport(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function summarizeRun(report) {
	return {
		runId: report.runId,
		dataset: report.dataset,
		finishedAt: report.finishedAt,
		summary: report.summary,
	};
}

function compareCase(caseId, baseline, candidate) {
	return {
		id: caseId,
		status: {
			baseline: baseline ? baseline.status : "missing",
			candidate: candidate ? candidate.status : "missing",
		},
		successChanged: Boolean(baseline && candidate && baseline.success !== candidate.success),
		delta: {
			executionTimeMs: deltaNumber(candidate, baseline, (result) => result.executionTimeMs),
			actionCount: deltaNumber(candidate, baseline, (result) => result.statistics.actionCount),
			retries: deltaNumber(candidate, baseline, (result) => result.statistics.retries),
			recoveryCount: deltaNumber(candidate, baseline, (result) => result.statistics.recoveryCount),
			unsupportedComponents: deltaNumber(candidate, baseline, (result) => result.statistics.unsupportedComponents),
			confidence: baseline && candidate
				? deltaNullable(candidate.statistics.confidence, baseline.statistics.confidence)
				: null,
			actionConfidence: baseline && candidate
				? deltaNullable(candidate.statistics.actionConfidence, baseline.statistics.actionConfidence)
				: null,
		},
	};
}

function deltaNumber(candidate, baseline, selector) {
	if (!candidate || !baseline) return null;
	return Number(selector(candidate) || 0) - Number(selector(baseline) || 0);
}

function deltaNullable(candidateValue, baselineValue) {
	if (candidateValue === null || baselineValue === null) return null;
	return candidateValue - baselineValue;
}

module.exports = {
	compareBenchmarkReportFiles,
	compareBenchmarkReports,
};
