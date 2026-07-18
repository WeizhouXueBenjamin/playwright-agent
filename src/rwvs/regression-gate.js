const fs = require("node:fs/promises");
const path = require("node:path");

async function loadPreviousRwvsReport(historyDir, currentRunId) {
	try {
		const entries = await fs.readdir(historyDir, { withFileTypes: true });
		const candidates = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.includes(currentRunId))
			.map((entry) => path.join(historyDir, entry.name))
			.sort();
		if (!candidates.length) return null;
		return JSON.parse(await fs.readFile(candidates[candidates.length - 1], "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
}

function evaluateRegression(current, previous) {
	if (!previous) {
		return {
			status: "NO_BASELINE",
			regressions: [],
		};
	}

	const regressions = [];
	addRegression(regressions, "Success Rate", current.metrics.successRate, previous.metrics.successRate, "lower");
	addRegression(regressions, "Coverage", current.metrics.coverage, previous.metrics.coverage, "lower");
	addRegression(regressions, "Verification Failures", current.metrics.verificationFailures, previous.metrics.verificationFailures, "higher");
	addRegression(regressions, "Runtime Errors", current.metrics.runtimeErrors, previous.metrics.runtimeErrors, "higher");

	return {
		status: regressions.length ? "REGRESSION" : "PASS",
		regressions,
	};
}

function addRegression(regressions, metric, current, previous, direction) {
	if (current === null || previous === null || current === undefined || previous === undefined) return;
	const regressed = direction === "lower" ? current < previous : current > previous;
	if (!regressed) return;
	regressions.push({
		metric,
		previous,
		current,
		direction,
	});
}

module.exports = {
	evaluateRegression,
	loadPreviousRwvsReport,
};
