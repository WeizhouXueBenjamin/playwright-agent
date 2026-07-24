const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

async function main() {
	const [runId] = process.argv.slice(2);
	if (!runId) throw new Error("Usage: npm run benchmark:add-case -- <run-id>");

	const artifactPath = path.join(process.cwd(), "logs", "apply", runId, "run-artifact.json");
	const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));
	const evidence = collectReplayEvidence(artifact);
	if (!evidence.length) {
		throw new Error("Run has insufficient reproducible evidence for a replay case.");
	}

	const replayDir = path.join(process.cwd(), "fixtures", "replay", "candidates");
	await fs.mkdir(replayDir, { recursive: true });
	const outputPath = path.join(replayDir, `${sanitizeId(runId)}.json`);
	const candidate = {
		schemaVersion: 1,
		mode: "redacted-replay-candidate",
		runId,
		sourceUrlHash: sha256(artifact.url || ""),
		status: artifact.status || "",
		reasons: evidence,
		fields: (artifact.filledFields || []).map(redactField),
		manualInterventions: (artifact.manualInterventions || []).map(redactReview),
		failures: artifact.failures || [],
		safetyStops: artifact.safetyStops || [],
		notes: "Review this candidate before moving it into fixtures/replay/offline-replay.json.",
	};

	await fs.writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
	console.log(JSON.stringify({ status: "created", path: outputPath, evidenceCount: evidence.length }, null, 2));
}

function collectReplayEvidence(artifact) {
	const evidence = [];
	if ((artifact.failures || []).length) evidence.push("verification-or-browser-failure");
	if ((artifact.safetyStops || []).length) evidence.push("safety-stop");
	if ((artifact.manualInterventions || []).length) evidence.push("manual-intervention");
	if (artifact.finalSubmissionTriggered === true || artifact.submitted === true) evidence.push("final-submit-triggered");
	return evidence;
}

function redactField(field) {
	return {
		fieldFingerprint: field.fieldFingerprint || "",
		labelPreview: preview(field.label && field.label.text || field.label || ""),
		controlType: field.controlType || "",
		profileSource: field.profileSource || "",
		resolutionMethod: field.resolutionMethod || "",
		verificationOutcome: field.verificationOutcome || "",
		userIntervened: field.userIntervened === true,
	};
}

function redactReview(item) {
	return {
		fieldIntent: item.fieldIntent || "",
		fieldFingerprint: item.fieldFingerprint || "",
		questionPreview: preview(item.question || ""),
		optionCount: Array.isArray(item.options) ? item.options.length : 0,
		reason: item.reason || "",
	};
}

function preview(value) {
	const text = String(value || "").replace(/\s+/g, " ").trim();
	return text.length <= 80 ? text : `${text.slice(0, 77)}...`;
}

function sanitizeId(value) {
	return String(value || "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
}

function sha256(value) {
	return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
