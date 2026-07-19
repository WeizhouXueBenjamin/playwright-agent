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
		"# Efficiency Metrics",
		"",
		table(["Metric", "Value"], efficiencyMetricRows(report)),
		"",
		"# Task Outcome",
		"",
		table(["Field", "Value"], taskOutcomeRows(report)),
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

function buildPostmortemMarkdown(report, options = {}) {
	return [
		"# RWVS Post-mortem",
		"",
		"## Task Summary",
		"",
		table(["Field", "Value"], taskSummaryRows(report)),
		"",
		"## V1 Result",
		"",
		table(["Metric", "Value"], v1ResultRows(report)),
		"",
		"## V2 Layer Diagnosis",
		"",
		table(["Layer", "Score", "Grade", "Diagnosis"], v2LayerDiagnosisRows(report)),
		"",
		"## Page Profile",
		"",
		table(["Field", "Value"], pageProfileRows(report)),
		"",
		"## Applicable Coverage",
		"",
		table(["Metric", "Value"], applicableCoverageRows(report)),
		"",
		"## Decision Metrics",
		"",
		table(["Metric", "Value"], decisionMetricRows(report)),
		"",
		"## Efficiency Metrics",
		"",
		table(["Metric", "Value"], efficiencyMetricRows(report)),
		"",
		"## Task Outcome",
		"",
		table(["Field", "Value"], taskOutcomeRows(report)),
		"",
		"## Blocking Issue",
		"",
		table(["Area", "Root Cause", "Impact"], blockingIssueRows(report)),
		"",
		"## Capability Gap",
		"",
		table(["Capability", "Gap", "Layer"], capabilityGapRows(report)),
		"",
		"## Evidence",
		"",
		table(["Source", "Evidence"], evidenceRows(report, options.executionReport)),
		"",
		"## Suggested Generic Improvement",
		"",
		table(["Priority", "Area", "Suggested Fix", "Status"], suggestedImprovementRows(report)),
		"",
		"## Regression Replay Result",
		"",
		table(["Field", "Value"], regressionReplayRows(report)),
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

function efficiencyMetricRows(report) {
	const efficiency = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.efficiency || {};
	return [
		["Total Actions", efficiency.totalActions || 0],
		["Repeated Field Attempts", efficiency.repeatedFieldAttempts || 0],
		["Skipped Verified Fields", efficiency.skippedVerifiedFields || 0],
		["Average Actions Per Completed Field", efficiency.averageActionsPerCompletedField || 0],
		["Redundant Action Ratio", formatPercent(efficiency.redundantActionRatio || 0)],
	];
}

function taskOutcomeRows(report) {
	const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
	return [
		["Status", outcome.status || "unknown"],
		["Reason", outcome.reason || ""],
		["Blocker Layer", outcome.blockerLayer || "none"],
		["Blocker Capability", outcome.blockerCapability || "none"],
		["Safety Outcome", outcome.safetyOutcome || "unknown"],
	];
}

function taskSummaryRows(report) {
	const task = report.metricsV2 && report.metricsV2.task || {};
	return [
		["Website", report.website || ""],
		["Run ID", report.runId || ""],
		["Finished At", report.finishedAt || ""],
		["Execution Status", task.status || "unknown"],
		["Completed Fields", task.completedFieldCount || 0],
		["Executed Actions", task.executedActionCount || 0],
	];
}

function v1ResultRows(report) {
	const metrics = report.metrics || {};
	return [
		["Result", report.result || ""],
		["Success Rate", formatPercent(metrics.successRate)],
		["Coverage", formatPercent(metrics.coverage)],
		["Health Score", `${metrics.healthScore} (${metrics.healthGrade})`],
		["Regression Status", report.regression ? report.regression.status : "unknown"],
	];
}

function v2LayerDiagnosisRows(report) {
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
		value ? diagnosisForLayer(layer, value) : "n/a",
	]);
}

function diagnosisForLayer(layer, health) {
	const inputs = health.inputs || {};
	const lowest = Object.entries(inputs)
		.sort((a, b) => Number(a[1]) - Number(b[1]))[0];
	if (!lowest) return `${layer} inputs unavailable`;
	return `${lowest[0]}=${formatDecimal(lowest[1])}`;
}

function blockingIssueRows(report) {
	const failure = selectBlockingFailure(report);
	if (!failure) {
		const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
		return [[outcome.blockerLayer || "None", outcome.reason || "No blocking failure detected", "Derived from task outcome"]];
	}
	return [[failure.area, failure.rootCause, failure.impact || ""]];
}

function capabilityGapRows(report) {
	const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
	const failure = selectBlockingFailure(report);
	return [[
		outcome.blockerCapability || "none",
		failure ? failure.rootCause : outcome.reason || "none",
		outcome.blockerLayer || "none",
	]];
}

function evidenceRows(report, executionReport = {}) {
	const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
	const decision = report.metricsV2 && report.metricsV2.decision || {};
	const efficiency = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.efficiency || {};
	const terminalState = getTerminalState(executionReport);
	const failure = selectBlockingFailure(report);
	const rows = [
		["metricsV2.task.outcome", compactJson(outcome)],
		["metricsV2.decision", `decisionCount=${decision.decisionCount || 0}; needsReviewCount=${decision.needsReviewCount || 0}; policyViolationCount=${decision.policyViolationCount || 0}`],
		["metricsV2.task.efficiency", `totalActions=${efficiency.totalActions || 0}; repeatedFieldAttempts=${efficiency.repeatedFieldAttempts || 0}; redundantActionRatio=${formatPercent(efficiency.redundantActionRatio || 0)}`],
	];
	if (terminalState.reason || terminalState.status) {
		rows.push(["executionReport.terminalState", compactJson({
			status: terminalState.status,
			reason: terminalState.reason,
		})]);
	}
	if (failure) {
		rows.push(["failureReport", `${failure.area}: ${failure.rootCause}`]);
	}
	return rows;
}

function suggestedImprovementRows(report) {
	const item = selectBacklogItem(report);
	if (!item) {
		const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
		return [["P2", outcome.blockerLayer || "Benchmark", genericImprovementForCapability(outcome.blockerCapability), "Open"]];
	}
	return [[item.priority, item.area, item.suggestedFix, item.status]];
}

function regressionReplayRows(report) {
	if (!report.regression) return [["Status", "unknown"]];
	if (report.regression.status === "NO_BASELINE") return [["Status", "NO_BASELINE"]];
	return [
		["Status", report.regression.status],
		["Regression Count", (report.regression.regressions || []).length],
	];
}

function selectBlockingFailure(report) {
	const failures = report.failureReport && report.failureReport.failures || [];
	const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
	if (!failures.length) return null;
	const capability = String(outcome.blockerCapability || "").toLowerCase();
	if (capability.includes("policy")) {
		return failures.find((failure) => {
			const text = failureText(failure);
			return text.includes("login") || text.includes("policy") || text.includes("confirmation") || text.includes("submit");
		}) || null;
	}
	if (capability.includes("field")) {
		return failures.find((failure) => {
			const text = failureText(failure);
			return text.includes("required field") || text.includes("label");
		}) || failures.find((failure) => failureText(failure).includes("component")) || failures[0];
	}
	if (capability.includes("verification")) return failures.find((failure) => failureText(failure).includes("verification")) || failures[0];
	if (capability.includes("recovery")) return failures.find((failure) => failureText(failure).includes("recovery")) || failures[0];
	return failures[0];
}

function selectBacklogItem(report) {
	const items = report.backlog && report.backlog.items || [];
	const failure = selectBlockingFailure(report);
	if (!items.length) return null;
	if (!failure) return null;
	return items.find((item) => item.area === failure.area && item.issue === failure.rootCause) || items[0];
}

function failureText(failure) {
	return `${failure.area || ""} ${failure.rootCause || ""}`.toLowerCase();
}

function genericImprovementForCapability(capability) {
	const improvements = {
		"Policy Navigation": "Improve generic safe navigation classification for application-entry and authentication-gated transitions.",
		"Runtime State Planning": "Use runtime state evidence to avoid repeated or non-progressing actions across cycles.",
		"Field Identification": "Improve label association and required-field detection using generic semantic context.",
		Verification: "Improve action-specific verification using observed runtime state changes.",
		Recovery: "Add generic fallback strategies after classifying the blocking failure.",
		"Safety / Policy": "Preserve final-submit blocking while improving policy explanations for safe stops.",
	};
	return improvements[capability] || "Continue collecting objective benchmark evidence before changing agent behavior.";
}

function getTerminalState(executionReport) {
	return (executionReport.executionTimeline || [])
		.map((entry) => entry.terminalState)
		.filter((terminal) => terminal && terminal.reached)
		.pop() || {};
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

function formatDecimal(value) {
	const number = Number(value);
	if (!Number.isFinite(number)) return String(value);
	return Math.round(number * 100) / 100;
}

function formatPercent(value) {
	if (value === null || value === undefined) return "n/a";
	return `${Math.round(value * 100)}%`;
}

module.exports = {
	buildBacklogMarkdown,
	buildBenchmarkMarkdown,
	buildPostmortemMarkdown,
};
