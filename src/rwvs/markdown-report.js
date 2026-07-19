function buildBenchmarkMarkdown(report) {
	return [
		"# Summary",
		"",
		`- Website: ${report.website}`,
		`- Run ID: ${report.runId}`,
		`- Date: ${report.finishedAt}`,
		`- Result: ${report.result}`,
		`- Health Score: ${report.metrics.healthScore} (${report.metrics.healthGrade})`,
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
		"# Page Profile",
		"",
		table(["Field", "Value"], pageProfileRows(report)),
		"",
		"# Applicable Coverage",
		"",
		table(["Metric", "Value"], applicableCoverageRows(report)),
		"",
		"# Decision Metrics",
		"",
		table(["Metric", "Value"], decisionMetricRows(report)),
		"",
		"# Layered Health",
		"",
		table(["Layer", "Score", "Grade", "Inputs", "Weights"], layeredHealthRows(report)),
		"",
		"# V1 vs V2 Explainability",
		"",
		...explainabilityLines(report),
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

function pageProfileRows(report) {
	const profile = report.metricsV2 && report.metricsV2.pageProfile || report.validationReport && report.validationReport.componentValidation.pageProfile || {};
	const signals = profile.signals || {};

	return [
		["Type", profile.type || "unknown"],
		["Confidence", formatPercent(profile.confidence || 0)],
		["Interactive Elements", signals.interactiveElementCount || 0],
		["Form Controls", signals.formControlCount || 0],
		["Application Entry Controls", signals.applicationEntryCount || 0],
		["Evidence", (profile.evidence || []).join("; ")],
	];
}

function applicableCoverageRows(report) {
	const coverage = report.validationReport && report.validationReport.componentValidation.coverage || {};
	const v2Coverage = report.metricsV2 && report.metricsV2.coverage || {};
	const applicable = report.validationReport && report.validationReport.componentValidation.applicableComponents
		|| report.metricsV2 && report.metricsV2.applicableComponents
		|| {};

	return [
		["Legacy Coverage Ratio", formatPercent(coverage.legacyCoverageRatio !== undefined ? coverage.legacyCoverageRatio : v2Coverage.legacyCoverageRatio)],
		["Applicable Coverage Ratio", formatPercent(coverage.applicableCoverageRatio !== undefined ? coverage.applicableCoverageRatio : v2Coverage.applicableCoverageRatio)],
		["Required Applicable", (applicable.required || []).join(", ")],
		["Optional Applicable", (applicable.optional || []).join(", ")],
		["Missing Required Applicable", (coverage.missingRequiredApplicableComponents || []).map((item) => item.type).join(", ") || "none"],
	];
}

function decisionMetricRows(report) {
	const decision = report.metricsV2 && report.metricsV2.decision || {};
	return [
		["Decision Count", decision.decisionCount || 0],
		["Action Decision Count", decision.actionDecisionCount || 0],
		["Needs-review Count", decision.needsReviewCount || 0],
		["Policy Compliant Count", decision.policyCompliantCount || 0],
		["Policy Violation Count", decision.policyViolationCount || 0],
		["Verification Consistent Count", decision.verificationConsistentCount || 0],
		["Verification Inconsistent Count", decision.verificationInconsistentCount || 0],
		["Required Field Progression Score", formatPercent(decision.requiredFieldProgressionScore)],
		["Strategy Consistency Score", formatPercent(decision.strategyConsistencyScore)],
	];
}

function layeredHealthRows(report) {
	const health = report.healthV2 || {};
	return [
		["Observation", health.observationHealth],
		["Decision", health.decisionHealth],
		["Page", health.pageHealth],
		["Task", health.taskHealth],
		["Benchmark", health.benchmarkHealth],
	].map(([layer, value]) => [
		layer,
		value ? value.score : "n/a",
		value ? value.grade : "n/a",
		value ? compactJson(value.inputs) : "",
		value ? compactJson(value.weights) : "",
	]);
}

function explainabilityLines(report) {
	const coverage = report.validationReport && report.validationReport.componentValidation.coverage || {};
	const v2Coverage = report.metricsV2 && report.metricsV2.coverage || {};
	const profile = report.metricsV2 && report.metricsV2.pageProfile || {};
	const missing = report.validationReport && report.validationReport.componentValidation.missingComponents || [];
	const applicableMissing = coverage.missingRequiredApplicableComponents || [];
	const nonApplicableNoise = missing.length
		? missing
			.map((item) => item.type)
			.filter((type) => !applicableMissing.some((item) => item.type === type))
		: inferNonApplicableNoise(report);

	return [
		`- V1 legacy coverage uses the fixed EXPECTED_COMPONENTS set and reported ${formatPercent(coverage.legacyCoverageRatio !== undefined ? coverage.legacyCoverageRatio : v2Coverage.legacyCoverageRatio)}.`,
		`- V2 classified the page as ${profile.type || "unknown"} and reported applicable coverage ${formatPercent(coverage.applicableCoverageRatio !== undefined ? coverage.applicableCoverageRatio : v2Coverage.applicableCoverageRatio)}.`,
		`- Non-applicable V1 missing component noise: ${nonApplicableNoise.join(", ") || "none"}.`,
		`- V2 localizes remaining evidence into Observation, Decision, Page, Task, and Benchmark layers without LLM scoring.`,
	];
}

function inferNonApplicableNoise(report) {
	const expectedComponents = [
		"text-input",
		"required-field",
		"label-association",
		"dropdown",
		"checkbox",
		"radio",
		"upload",
		"navigation-button",
		"validation-message",
	];
	const applicable = report.metricsV2 && report.metricsV2.applicableComponents || {};
	const applicableTypes = new Set([...(applicable.required || []), ...(applicable.optional || [])]);
	return expectedComponents.filter((type) => !applicableTypes.has(type));
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
		["Health Score", report.previousMetrics.healthScore, report.metrics.healthScore, metricStatus(report, "Health Score")],
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

function compactJson(value) {
	return JSON.stringify(value);
}

function formatPercent(value) {
	if (value === null || value === undefined) return "n/a";
	return `${Math.round(value * 100)}%`;
}

module.exports = {
	buildBacklogMarkdown,
	buildBenchmarkMarkdown,
};
