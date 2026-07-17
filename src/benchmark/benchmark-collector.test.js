const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { collectObservationBenchmark } = require("./benchmark-collector");

async function main() {
	const result = await collectObservationBenchmark(createBenchmarkPageUrl(), {
		logsDir: "logs/test-observations",
	});

	const report = result.report;
	assert.equal(report.mode, "observation");
	assert.equal(report.zeroSideEffects, true);
	assert.equal(report.summary.detectedFieldCount >= 2, true);
	assert.equal(report.summary.consoleErrorCount >= 1, true);
	assert.equal(report.summary.networkErrorCount >= 1, true);

	const expectedArtifacts = [
		"dom-snapshot.html",
		"semantic-page.json",
		"accessibility-snapshot.json",
		"screenshot.png",
		"runtime-state.json",
		"reasoning-log.json",
		"console-errors.json",
		"network-errors.json",
		"observation-report.json",
	];

	for (const artifact of expectedArtifacts) {
		const stats = await fs.stat(path.join(result.runDir, artifact));
		assert.equal(stats.size > 0, true, `${artifact} should be non-empty`);
	}

	const html = await fs.readFile(path.join(result.runDir, "dom-snapshot.html"), "utf8");
	assert.equal(html.includes("data-clicked="), false);

	const runtimeState = JSON.parse(await fs.readFile(path.join(result.runDir, "runtime-state.json"), "utf8"));
	assert.equal(runtimeState.completedActions.length, 0);
	assert.equal(runtimeState.currentExecutionStatus, "observation-completed");
}

function createBenchmarkPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<button type=\"button\" onclick=\"document.body.dataset.clicked = 'clicked'\">Do not click</button>",
		"</form>",
		"<script>",
		"console.error('benchmark console error');",
		"fetch('https://invalid.invalid/benchmark-observation-mode').catch(() => {});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
