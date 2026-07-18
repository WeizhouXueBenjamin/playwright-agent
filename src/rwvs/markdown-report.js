function buildBenchmarkMarkdown(report) {
	return [
		"# Summary",
		"",
		`- Website: ${report.website}`,
		`- Run ID: ${report.runId}`,
		`- Date: ${report.finishedAt}`,
		`- Result: ${report.result}`,
		`- Success Rate: ${formatPercent(report.metrics.successRate)}`,
		`- Coverage: ${formatPercent(report.metrics.coverage)}`,
		`- Execution Time: ${report.metrics.executionTimeMs} ms`,
		`- Retries: ${report.metrics.retries}`,
		`- Recovery: ${report.metrics.recoveryCount}`,
		`- Verification Failures: ${report.metrics.verificationFailures}`,
		`- Stopped Before Submit: ${report.metrics.stoppedBeforeSubmit ? "yes" : "no"}`,
		"",
		"# Component Coverage",
		"",
		table(["Component", "Count"], componentCoverageRows(report)),
		"",
		"# Failure Summary",
		"",
		table(["Area", "Root Cause", "Impact"], failureRows(report)),
		"",
		"# Suggested Improvements",
		"",
		table(["Priority", "Area", "Issue", "Suggested Fix", "Estimated Impact", "Status"], backlogRows(report)),
		"",
		"# Historical Comparison",
		"",
		table(["Metric", "Previous", "Current", "Status"], comparisonRows(report)),
		"",
	].join("\n");
}

function buildBacklogMarkdown(backlog) {
	return [
		"# Improvement Backlog",
		"",
		table(["Priority", "Area", "Issue", "Suggested Fix", "Estimated Impact", "Status"], backlog.items.map((item) => [
			item.priority,
			item.area,
			item.issue,
			item.suggestedFix,
			item.estimatedImpact,
			item.status,
		])),
		"",
	].join("\n");
}

function componentCoverageRows(report) {
	const counts = report.validationReport && report.validationReport.componentValidation.coverage.counts || {};
	return Object.entries(counts).map(([component, count]) => [component, String(count)]);
}

function failureRows(report) {
	const failures = report.failureReport.failures || [];
	if (!failures.length) return [["None", "No failures detected", "No immediate impact"]];
	return failures.map((failure) => [failure.area, failure.rootCause, failure.impact]);
}

function backlogRows(report) {
	return report.backlog.items.map((item) => [
		item.priority,
		item.area,
		item.issue,
		item.suggestedFix,
		item.estimatedImpact,
		item.status,
	]);
}

function comparisonRows(report) {
	if (!report.regression || report.regression.status === "NO_BASELINE") {
		return [["Baseline", "none", "current", "NO_BASELINE"]];
	}

	const rows = [
		["Success Rate", formatPercent(report.previousMetrics.successRate), formatPercent(report.metrics.successRate), metricStatus(report, "Success Rate")],
		["Coverage", formatPercent(report.previousMetrics.coverage), formatPercent(report.metrics.coverage), metricStatus(report, "Coverage")],
		["Verification Failures", report.previousMetrics.verificationFailures, report.metrics.verificationFailures, metricStatus(report, "Verification Failures")],
		["Runtime Errors", report.previousMetrics.runtimeErrors, report.metrics.runtimeErrors, metricStatus(report, "Runtime Errors")],
	];

	return rows;
}

function metricStatus(report, metric) {
	return report.regression.regressions.some((regression) => regression.metric === metric) ? "REGRESSION" : "PASS";
}

function table(headers, rows) {
	return [
		`| ${headers.join(" | ")} |`,
		`| ${headers.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
	].join("\n");
}

function escapeCell(value) {
	return String(value === undefined || value === null ? "" : value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatPercent(value) {
	if (value === null || value === undefined) return "n/a";
	return `${Math.round(value * 100)}%`;
}

module.exports = {
	buildBacklogMarkdown,
	buildBenchmarkMarkdown,
};
