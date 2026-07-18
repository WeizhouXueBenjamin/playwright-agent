function buildImprovementBacklog(failureReport) {
	const failures = failureReport.failures || [];
	const rows = failures.map((item, index) => ({
		priority: priorityFor(item, index),
		area: item.area,
		issue: item.rootCause,
		suggestedFix: item.suggestedImprovement,
		estimatedImpact: estimatedImpactFor(item.area),
		status: "Open",
	}));

	return {
		schemaVersion: 1,
		mode: "rwvs-improvement-backlog",
		runId: failureReport.runId,
		items: rows.length ? rows : [{
			priority: "P3",
			area: "Benchmark",
			issue: "No failures detected in this run.",
			suggestedFix: "Continue collecting real-world benchmark coverage before changing agent behavior.",
			estimatedImpact: "Low",
			status: "Monitoring",
		}],
	};
}

function buildImprovementSummary(backlog) {
	return {
		schemaVersion: 1,
		mode: "rwvs-improvement-summary",
		status: "proposed",
		note: "RWVS proposes generic improvements only. Code changes are not considered fixed until a later benchmark confirms improvement.",
		items: backlog.items,
	};
}

function priorityFor(item, index) {
	if (item.area === "Execution" || item.area === "Verification" || item.area === "Recovery") return "P1";
	if (item.area === "Detection" || item.area === "Reasoning" || item.area === "Planning") return "P2";
	return index < 3 ? "P2" : "P3";
}

function estimatedImpactFor(area) {
	if (area === "Execution" || area === "Verification" || area === "Detection") return "High";
	if (area === "Recovery" || area === "Reasoning" || area === "Planning") return "Medium";
	return "Low";
}

module.exports = {
	buildImprovementBacklog,
	buildImprovementSummary,
};
