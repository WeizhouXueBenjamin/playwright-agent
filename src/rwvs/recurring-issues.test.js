const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { buildRecurringIssueAnalysis, updateRecurringIssueArtifacts } = require("./recurring-issues");

async function main() {
	const rootDir = path.join("logs", `test-recurring-${Date.now()}`);
	await writeReport(rootDir, "job-boards-greenhouse-io", {
		website: "job-boards-greenhouse-io",
		finishedAt: "2026-07-19T01:00:00.000Z",
		improvementProposals: {
			items: [
				proposal("Field Identification", "Improve generic field identification", "Required field cannot be safely matched without a label.", "High", "Medium"),
				proposal("Verification", "Improve action verification", "verification regression after field fill", "High", "High"),
			],
		},
	});
	await writeReport(rootDir, "workable-example", {
		website: "workable-example",
		finishedAt: "2026-07-19T02:00:00.000Z",
		improvementProposals: {
			items: [
				proposal("Field Identification", "Improve generic field identification", "Required field cannot be safely matched without a label.", "High", "Medium"),
				proposal("Safety / Policy", "Improve policy stop explainability", "final submit blocked", "Medium", "High"),
			],
		},
	});
	await writeReport(rootDir, "single-low-impact", {
		website: "single-low-impact",
		finishedAt: "2026-07-19T03:00:00.000Z",
		improvementProposals: {
			items: [
				proposal("Page Profile", "Improve deterministic page profiling", "Runtime page errors were observed.", "Low", "Low"),
			],
		},
	});

	const analysis = await buildRecurringIssueAnalysis(rootDir);
	const fieldIssue = analysis.issues.find((issue) => issue.capability === "Field Identification");
	const policyIssue = analysis.issues.find((issue) => issue.capability === "Safety / Policy");
	const verificationIssue = analysis.issues.find((issue) => issue.capability === "Verification");
	const lowIssue = analysis.issues.find((issue) => issue.capability === "Page Profile");

	assert.equal(analysis.mode, "rwvs-recurring-issues");
	assert.equal(fieldIssue.status, "recurring");
	assert.equal(fieldIssue.priority, "P1");
	assert.equal(fieldIssue.occurrences, 2);
	assert.deepEqual(fieldIssue.platforms.sort(), ["Greenhouse", "workable-example"].sort());
	assert.equal(policyIssue.priority, "P0");
	assert.equal(verificationIssue.priority, "P1");
	assert.equal(lowIssue.priority, "P3");
	assert.equal(lowIssue.status, "open");

	await updateRecurringIssueArtifacts(rootDir);
	const markdown = await fs.readFile(path.join(rootDir, "recurring-issues.md"), "utf8");
	const json = JSON.parse(await fs.readFile(path.join(rootDir, "recurring-issues.json"), "utf8"));
	assert.equal(markdown.includes("# Recurring Issues"), true);
	assert.equal(markdown.includes("Field Identification"), true);
	assert.equal(json.mode, "rwvs-recurring-issues");
}

function proposal(capability, title, issue, expectedImpact, regressionRisk) {
	return {
		capability,
		title,
		evidence: [`issue=${issue}`],
		affectedLayers: ["Task"],
		expectedImpact,
		regressionRisk,
		suggestedScope: `Scope for ${capability}`,
		candidateTests: [`test ${capability}`],
		status: "proposed",
	};
}

async function writeReport(rootDir, benchmarkId, report) {
	const reportDir = path.join(rootDir, benchmarkId, "reports");
	await fs.mkdir(reportDir, { recursive: true });
	await fs.writeFile(path.join(reportDir, "benchmark-report.json"), JSON.stringify(report, null, 2));
	await fs.writeFile(path.join(reportDir, "improvement-proposals.json"), JSON.stringify(report.improvementProposals, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
