const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { runRealWebsiteValidation } = require("./rwvs-runner");

async function main() {
	const rootDir = path.join("logs", `test-rwvs-${Date.now()}`);
	const commonInput = {
		websiteId: "local-rwvs",
		profile: {
			firstName: "Aroha",
			email: "aroha@example.com",
			country: "New Zealand",
		},
		resume: __filename,
		coverLetter: __filename,
		options: { maxCycles: 12 },
	};

	const baseline = await runRealWebsiteValidation({
		...commonInput,
		url: createApplicationUrl(),
	}, { rootDir });

	assert.equal(baseline.report.mode, "rwvs");
	assert.equal(baseline.report.result, "PASS");
	assert.equal(baseline.report.regression.status, "NO_BASELINE");
	assert.equal(baseline.report.metrics.stoppedBeforeSubmit, true);
	assert.equal(baseline.report.metrics.successRate, 1);
	assert.equal(typeof baseline.report.metrics.healthScore, "number");
	assert.equal(baseline.report.health.mode, "validation-health-score");

	const reportDir = path.join(baseline.rootDir, "reports");
	const benchmarkMarkdown = await fs.readFile(path.join(reportDir, "benchmark.md"), "utf8");
	const backlogMarkdown = await fs.readFile(path.join(reportDir, "backlog.md"), "utf8");
	assert.equal(benchmarkMarkdown.includes("# Summary"), true);
	assert.equal(benchmarkMarkdown.includes("Health Score"), true);
	assert.equal(benchmarkMarkdown.includes("# Historical Comparison"), true);
	assert.equal(backlogMarkdown.includes("| Priority | Area | Issue | Suggested Fix | Estimated Impact | Status |"), true);

	const regression = await runRealWebsiteValidation({
		...commonInput,
		url: createLowCoverageUrl(),
	}, { rootDir });

	assert.equal(regression.report.result, "REGRESSION");
	assert.equal(regression.report.regression.status, "REGRESSION");
	assert.equal(regression.report.regression.regressions.some((item) => item.metric === "Coverage"), true);
}

function createApplicationUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<label for=\"email\">Email address</label>",
		"<input id=\"email\" name=\"email\" type=\"email\" required>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\" required>",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"<label for=\"resume\">Resume</label>",
		"<input id=\"resume\" name=\"resume\" type=\"file\" required>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createLowCoverageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
