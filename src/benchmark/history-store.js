const fs = require("node:fs/promises");
const path = require("node:path");

async function appendBenchmarkHistory(baseDir, report) {
	const historyPath = path.join(baseDir, "history.json");
	const history = await readHistory(historyPath);
	const entry = {
		runId: report.runId,
		dataset: report.dataset,
		finishedAt: report.finishedAt,
		durationMs: report.durationMs,
		summary: report.summary,
		reportPath: path.join(report.artifacts.runDir, report.artifacts.benchmarkReport),
	};

	const nextHistory = {
		schemaVersion: 1,
		updatedAt: new Date().toISOString(),
		runs: [...history.runs, entry],
	};

	await fs.mkdir(baseDir, { recursive: true });
	await fs.writeFile(historyPath, `${JSON.stringify(nextHistory, null, 2)}\n`, "utf8");
	return historyPath;
}

async function readHistory(historyPath) {
	try {
		return JSON.parse(await fs.readFile(historyPath, "utf8"));
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		return {
			schemaVersion: 1,
			runs: [],
		};
	}
}

module.exports = {
	appendBenchmarkHistory,
};
