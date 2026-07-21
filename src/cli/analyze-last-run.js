const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
	const baseDir = path.join(process.cwd(), "logs", "apply");
	const latestRunDir = await findLatestRunDir(baseDir);
	if (!latestRunDir) {
		console.log(JSON.stringify({
			status: "no-runs-found",
			submitted: false,
			message: "No apply run artifacts found under logs/apply.",
			nextAction: "Run npm run apply -- <job-url> before analyzing the latest run.",
		}, null, 2));
		return;
	}

	const artifactPath = path.join(latestRunDir, "run-artifact.json");
	const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));
	const diagnostics = buildDiagnostics(artifact);
	const issues = buildRecurringIssueSnapshot(artifact, diagnostics);
	const proposals = buildAdvisoryProposals(issues);

	await fs.writeFile(path.join(latestRunDir, "diagnostics.json"), `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
	await fs.writeFile(path.join(latestRunDir, "recurring-issues.json"), `${JSON.stringify(issues, null, 2)}\n`, "utf8");
	await fs.writeFile(path.join(latestRunDir, "improvement-proposals.json"), `${JSON.stringify(proposals, null, 2)}\n`, "utf8");

	console.log(JSON.stringify({
		runId: artifact.runId,
		status: artifact.status,
		submitted: artifact.submitted === true,
		filledFields: artifact.filledFields.length,
		manualReviewItems: artifact.manualInterventions.length,
		failures: diagnostics.failures.length,
		safetyStops: artifact.safetyStops.length,
		nextAction: diagnostics.nextAction,
		diagnosticsPath: path.join(latestRunDir, "diagnostics.json"),
	}, null, 2));
}

async function findLatestRunDir(baseDir) {
	const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
	const runDirs = entries
		.filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
		.map((entry) => path.join(baseDir, entry.name))
		.sort();

	return runDirs.pop() || null;
}

function buildDiagnostics(artifact) {
	const failures = [
		...(artifact.failures || []),
		...(artifact.manualInterventions || []).map((item) => ({
			category: "manual-review-required",
			reason: item.reason || "User review required",
			fieldIntent: item.fieldIntent || "",
			fieldFingerprint: item.fieldFingerprint || "",
		})),
		...(artifact.safetyStops || []).map((item) => ({
			category: "safety-blocked",
			reason: item.reason || "Safety stop",
		})),
	];

	return {
		schemaVersion: 1,
		mode: "apply-last-run-diagnostics",
		runId: artifact.runId,
		url: artifact.url,
		status: artifact.status,
		submitted: artifact.submitted === true,
		filledFields: artifact.filledFields || [],
		generatedAnswers: artifact.generatedAnswers || [],
		manualInterventions: artifact.manualInterventions || [],
		failures,
		nextAction: nextActionFor(artifact, failures),
	};
}

function buildRecurringIssueSnapshot(artifact, diagnostics) {
	const grouped = new Map();
	for (const failure of diagnostics.failures) {
		const signature = normalizeSignature(failure);
		const existing = grouped.get(signature) || {
			signature,
			category: failure.category || "semantic-resolution-failed",
			occurrences: 0,
			affectedRuns: [],
			status: "open",
			priority: "",
			evidence: [],
		};
		existing.occurrences += 1;
		existing.affectedRuns = unique([...existing.affectedRuns, artifact.runId].filter(Boolean));
		existing.evidence = unique([...existing.evidence, failure.reason || ""]);
		existing.priority = priorityFor(existing.category, existing.occurrences);
		grouped.set(signature, existing);
	}

	return {
		schemaVersion: 1,
		mode: "apply-recurring-issue-snapshot",
		generatedAt: new Date().toISOString(),
		issues: [...grouped.values()].sort(compareIssues),
	};
}

function buildAdvisoryProposals(issueSnapshot) {
	return {
		schemaVersion: 1,
		mode: "apply-advisory-improvement-proposals",
		generatedAt: new Date().toISOString(),
		items: issueSnapshot.issues.map((issue) => ({
			title: titleForIssue(issue),
			evidence: issue.evidence,
			rootCause: "The latest run produced a repeated or blocking issue in the active apply workflow.",
			genericImprovement: improvementFor(issue.category),
			candidateTests: testsFor(issue.category),
			risk: issue.priority === "P0" || issue.priority === "P1" ? "high" : "medium",
			status: "proposed",
		})),
	};
}

function nextActionFor(artifact, failures) {
	if (artifact.submitted === true) return "Investigate final-submit protection immediately.";
	if ((artifact.manualInterventions || []).length > 0) return "Answer the pending review prompt, then resume the apply run.";
	if (failures.length > 0) return "Inspect diagnostics.json and decide whether to add a replay fixture.";
	if (artifact.status === "awaiting-human-confirmation") return "Review the completed page manually; do not submit through the agent.";
	return "No action required unless this run should become a replay case.";
}

function normalizeSignature(failure) {
	return [
		failure.category || "semantic-resolution-failed",
		failure.fieldIntent || "unknown-field",
		normalizeText(failure.reason || ""),
	].join(":");
}

function normalizeText(value) {
	return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function priorityFor(category, occurrences) {
	if (category === "safety-blocked") return "P0";
	if (category === "verification-failed") return "P1";
	if (occurrences > 1) return "P2";
	return "P3";
}

function compareIssues(a, b) {
	const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
	return priorityOrder[a.priority] - priorityOrder[b.priority]
		|| b.occurrences - a.occurrences
		|| a.signature.localeCompare(b.signature);
}

function titleForIssue(issue) {
	const titles = {
		"manual-review-required": "Reduce avoidable manual review",
		"safety-blocked": "Improve safety stop explainability",
		"verification-failed": "Improve field verification",
		"browser-action-failed": "Improve browser action fallback",
	};
	return titles[issue.category] || "Improve semantic field resolution";
}

function improvementFor(category) {
	const improvements = {
		"manual-review-required": "Add a small generic resolver or clearer user prompt only after confirming the field is safe to automate.",
		"safety-blocked": "Keep the safety stop and improve the review prompt with exact field context and allowed options.",
		"verification-failed": "Re-observe after the action and compare only action-specific stable state.",
		"browser-action-failed": "Retry once after re-observation, then ask the user to complete the field manually.",
	};
	return improvements[category] || "Use observed label, nearby text, options, and bounded profile facts before asking the user.";
}

function testsFor(category) {
	const tests = {
		"manual-review-required": ["ambiguous field becomes user review"],
		"safety-blocked": ["legal/privacy field requires confirmation", "final Submit is never clicked"],
		"verification-failed": ["filled field is verified before being marked complete"],
		"browser-action-failed": ["failed action retries once"],
	};
	return tests[category] || ["semantic resolution fallback asks user when uncertain"];
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
