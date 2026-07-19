const fs = require("node:fs/promises");
const path = require("node:path");

const { writeJsonArtifact, writeTextArtifact } = require("../logging/artifact-store");

const RECURRING_ISSUES_SCHEMA_VERSION = 1;

async function updateRecurringIssueArtifacts(baseDir) {
	const analysis = await buildRecurringIssueAnalysis(baseDir);
	await writeJsonArtifact(baseDir, "recurring-issues.json", analysis);
	await writeTextArtifact(baseDir, "recurring-issues.md", buildRecurringIssuesMarkdown(analysis));
	return analysis;
}

async function buildRecurringIssueAnalysis(baseDir) {
	const reports = await readBenchmarkReports(baseDir);
	const occurrences = reports.flatMap((report) => proposalOccurrences(report));
	const issues = aggregateOccurrences(occurrences);

	return {
		schemaVersion: RECURRING_ISSUES_SCHEMA_VERSION,
		mode: "rwvs-recurring-issues",
		generatedAt: new Date().toISOString(),
		issues,
	};
}

async function readBenchmarkReports(baseDir) {
	const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
	const reports = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const reportDir = path.join(baseDir, entry.name, "reports");
		const report = await readJson(path.join(reportDir, "benchmark-report.json"));
		if (!report) continue;
		const proposals = await readJson(path.join(reportDir, "improvement-proposals.json"));
		reports.push({
			...report,
			improvementProposals: proposals || report.improvementProposals,
		});
	}

	return reports;
}

async function readJson(filePath) {
	try {
		return JSON.parse(await fs.readFile(filePath, "utf8"));
	} catch {
		return null;
	}
}

function proposalOccurrences(report) {
	const proposals = report.improvementProposals && report.improvementProposals.items || [];
	return proposals
		.filter((proposal) => proposal.status === "proposed")
		.map((proposal) => {
			const capabilityGap = inferCapabilityGap(proposal);
			return {
				capability: proposal.capability,
				capabilityGap,
				platform: inferPlatform(report),
				benchmark: report.website || report.runId,
				seenAt: report.finishedAt || report.startedAt || "",
				expectedImpact: proposal.expectedImpact || "Low",
				regressionRisk: proposal.regressionRisk || "Low",
				relatedImprovement: proposal.suggestedScope || "",
				status: proposal.status,
				evidence: proposal.evidence || [],
			};
		});
}

function inferCapabilityGap(proposal) {
	const issue = (proposal.evidence || [])
		.find((item) => String(item).startsWith("issue="));
	if (issue) return issue.slice("issue=".length);

	const reason = (proposal.evidence || [])
		.find((item) => String(item).startsWith("reason="));
	if (reason) return reason.slice("reason=".length);

	return proposal.title || proposal.capability;
}

function aggregateOccurrences(occurrences) {
	const grouped = new Map();

	for (const occurrence of occurrences) {
		const key = occurrence.capability;
		const group = grouped.get(key) || {
			capability: occurrence.capability,
			_occurrences: [],
		};
		group._occurrences.push(occurrence);
		grouped.set(key, group);
	}

	return [...grouped.values()]
		.map(finalizeIssue)
		.sort(compareIssues);
}

function finalizeIssue(group) {
	const occurrences = group._occurrences;
	const platforms = unique(occurrences.map((item) => item.platform));
	const benchmarks = unique(occurrences.map((item) => item.benchmark));
	const firstSeen = occurrences
		.map((item) => item.seenAt)
		.filter(Boolean)
		.sort()[0] || "";
	const lastSeen = occurrences
		.map((item) => item.seenAt)
		.filter(Boolean)
		.sort()
		.pop() || "";
	const priority = priorityFor({
		capability: group.capability,
		occurrences: occurrences.length,
		platforms,
		expectedImpact: strongest(occurrences.map((item) => item.expectedImpact), ["Low", "Medium", "High"]),
		regressionRisk: strongest(occurrences.map((item) => item.regressionRisk), ["Low", "Medium", "High"]),
		evidence: occurrences.flatMap((item) => item.evidence),
	});

	return {
		capability: group.capability,
		capabilityGap: summarizeCapabilityGaps(group.capability, occurrences),
		capabilityGaps: unique(occurrences.map((item) => item.capabilityGap)),
		occurrences: occurrences.length,
		platforms,
		benchmarks,
		firstSeen,
		lastSeen,
		priority,
		status: platforms.length > 1 ? "recurring" : "open",
		relatedImprovements: unique(occurrences.map((item) => item.relatedImprovement)),
	};
}

function priorityFor(input) {
	const capability = String(input.capability || "").toLowerCase();
	const evidenceText = input.evidence.join(" ").toLowerCase();

	if (capability.includes("safety") || capability.includes("policy")) return "P0";
	if (capability.includes("verification") && (input.regressionRisk === "High" || evidenceText.includes("regression"))) return "P1";
	if (input.platforms.length > 1 && input.expectedImpact === "High") return "P1";
	if (input.platforms.length > 1) return "P2";
	if (input.occurrences > 1 && input.expectedImpact !== "Low") return "P2";
	return "P3";
}

function buildRecurringIssuesMarkdown(analysis) {
	return [
		"# Recurring Issues",
		"",
		table([
			"Priority",
			"Status",
			"Capability",
			"Gap",
			"Occurrences",
			"Platforms",
			"Benchmarks",
			"First Seen",
			"Last Seen",
		"Related Improvements",
	], analysis.issues.map((issue) => [
			issue.priority,
			issue.status,
			issue.capability,
			issue.capabilityGaps ? issue.capabilityGaps.join("; ") : issue.capabilityGap,
			issue.occurrences,
			issue.platforms.join(", "),
			issue.benchmarks.join(", "),
			issue.firstSeen,
			issue.lastSeen,
			issue.relatedImprovements.join("; "),
		])),
		"",
	].join("\n");
}

function compareIssues(a, b) {
	const priority = { P0: 0, P1: 1, P2: 2, P3: 3 };
	return priority[a.priority] - priority[b.priority]
		|| b.occurrences - a.occurrences
		|| a.capability.localeCompare(b.capability)
		|| a.capabilityGap.localeCompare(b.capabilityGap);
}

function inferPlatform(report) {
	const website = report.website || "";
	if (website.includes("greenhouse")) return "Greenhouse";
	if (website.includes("qjumpers")) return "QJumpers";
	return website || "unknown";
}

function summarizeCapabilityGaps(capability, occurrences) {
	const gaps = unique(occurrences.map((item) => item.capabilityGap));
	if (gaps.length === 1) return gaps[0];
	return `Multiple ${capability} gaps`;
}

function strongest(values, order) {
	return values.reduce((strongestValue, value) => {
		return order.indexOf(value) > order.indexOf(strongestValue) ? value : strongestValue;
	}, order[0]);
}

function unique(values) {
	return [...new Set((values || []).filter(Boolean))];
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

module.exports = {
	buildRecurringIssueAnalysis,
	buildRecurringIssuesMarkdown,
	updateRecurringIssueArtifacts,
};
