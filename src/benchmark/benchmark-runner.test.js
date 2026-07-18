const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { compareBenchmarkReports } = require("./benchmark-comparison");
const { runBenchmark } = require("./benchmark-runner");

async function main() {
	const datasetPath = path.join(process.cwd(), "logs", "test-benchmark-dataset.json");
	await fs.mkdir(path.dirname(datasetPath), { recursive: true });
	await fs.writeFile(datasetPath, `${JSON.stringify(createDataset(), null, 2)}\n`, "utf8");

	const result = await runBenchmark(datasetPath, {
		logsDir: "logs/test-benchmarks",
		maxCycles: 20,
	});

	assert.equal(result.report.mode, "end-to-end-benchmark");
	assert.equal(result.report.summary.totalCases, 1);
	assert.equal(result.report.summary.successfulCases, 1);
	assert.equal(result.report.summary.totalActionCount > 0, true);
	assert.equal(result.report.summary.totalRetries, 1);
	assert.equal(typeof result.report.summary.healthScore, "number");
	assert.equal(result.report.health.mode, "validation-health-score");
	assert.equal(result.report.summary.averageActionConfidence !== null, true);
	assert.equal(result.report.caseResults[0].statistics.runtimeSnapshotCount > 0, true);
	assert.equal(result.report.caseResults[0].artifacts.screenshots.length, 1);
	assert.equal(result.report.caseResults[0].artifacts.reasoningLogs.length, 2);
	assert.equal(Boolean(result.historyPath), true);

	const comparison = compareBenchmarkReports(result.report, {
		...result.report,
		runId: "candidate",
		summary: {
			...result.report.summary,
			successfulCases: result.report.summary.successfulCases - 1,
			failedCases: result.report.summary.failedCases + 1,
			successRate: 0,
		},
	});

	assert.equal(comparison.mode, "benchmark-comparison");
	assert.equal(comparison.delta.successfulCases, -1);
}

function createDataset() {
	return {
		name: "local-regression-benchmark",
		version: "1",
		cases: [
			{
				id: "local-multi-step",
				name: "Local Multi Step",
				url: createApplicationUrl(),
				profile: {
					firstName: "Aroha",
					lastName: "Smith",
					email: "aroha@example.com",
					country: "New Zealand",
					agreement: true,
				},
				resume: path.join(process.cwd(), "src", "benchmark", "benchmark-runner.test.js"),
				coverLetter: path.join(process.cwd(), "src", "benchmark", "benchmark-runner.test.js"),
				tags: ["local", "multi-step"],
			},
		],
	};
}

function createApplicationUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<section id=\"step-1\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<label for=\"last\">Last name</label>",
		"<input id=\"last\" name=\"lastName\" required>",
		"<label for=\"email\">Email address</label>",
		"<input id=\"email\" name=\"email\" type=\"email\" required>",
		"<label><input type=\"checkbox\" name=\"agreement\" required> I agree</label>",
		"<button type=\"button\" id=\"continue\">Continue</button>",
		"</section>",
		"<section id=\"step-2\" hidden>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\" required>",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"<label for=\"resume\">Resume</label>",
		"<input id=\"resume\" name=\"resume\" type=\"file\" required>",
		"<label for=\"cover\">Cover letter</label>",
		"<input id=\"cover\" name=\"coverLetter\" type=\"file\" required>",
		"<button type=\"submit\">Submit application</button>",
		"</section>",
		"</form>",
		"<script>",
		"let continueClicks = 0;",
		"document.querySelector('#continue').addEventListener('click', () => {",
		"continueClicks += 1;",
		"if (continueClicks < 2) return;",
		"document.querySelector('#step-1').hidden = true;",
		"document.querySelector('#step-2').hidden = false;",
		"});",
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
