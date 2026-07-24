const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");

const { BrowserAIAgent } = require("../agent/browser-ai-agent");
const { createRunLogDir, writeJsonArtifact } = require("../logging/artifact-store");

const DEFAULT_PROFILE_PATH = path.join("data", "profile-full-stack.json");

async function main() {
	const [url, profilePath = DEFAULT_PROFILE_PATH, resumePath = "", coverLetterPath = ""] = process.argv.slice(2);

	if (!url) {
		throw new Error("Usage: npm run apply -- <url> [profile.json] [resume] [cover-letter]");
	}

	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const agent = new BrowserAIAgent({
		headless: false,
		persistent: true,
		userDataDir: path.resolve(".playwright", "apply-profile"),
		reviewAnswerProvider: process.stdin.isTTY ? createCliReviewAnswerProvider() : null,
	});
	const result = await agent.completeJobApplication({
		url: new URL(url).toString(),
		profile,
		resume: resumePath,
		coverLetter: coverLetterPath,
	});
	result.productStatus = normalizeProductStatus(result);

	const compactArtifact = buildCompactRunArtifact({
		url,
		profilePath,
		resumePath,
		coverLetterPath,
		result,
	});
	const { runId, runDir } = await createRunLogDir(path.join("logs", "apply"));
	compactArtifact.runId = runId;
	const artifactPath = await writeJsonArtifact(runDir, "run-artifact.json", compactArtifact);

	console.error(`Run artifact: ${artifactPath}`);
	console.log(JSON.stringify(result, null, 2));
}

function createCliReviewAnswerProvider() {
	return async ({ reviewPrompt, page }) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		try {
			console.error("");
			console.error(reviewPrompt.question ? buildPromptText(reviewPrompt) : "Review required.");
			while (true) {
				const command = (await rl.question("[A]ccept [E]dit [S]kip [M]anual [Q]uit > ")).trim().toLowerCase();
				if (command === "q" || command === "quit" || command === "/stop") {
					return { command: "stop" };
				}
				if (command === "s" || command === "skip") {
					return { command: "skip" };
				}
				if (command === "m" || command === "manual") {
					console.error("Complete the field in the browser, then press Enter here to continue.");
					await rl.question("");
					if (page && typeof page.waitForTimeout === "function") await page.waitForTimeout(250);
					return { command: "manual" };
				}
				if (command === "a" || command === "accept") {
					if (!reviewPrompt.currentProfileValue) {
						console.error("No suggestion is available to accept. Choose Edit, Skip, Manual, or Quit.");
						continue;
					}
					const confirmation = (await rl.question(`Use "${reviewPrompt.currentProfileValue}" for this run? [y/N] `)).trim().toLowerCase();
					if (confirmation === "y" || confirmation === "yes") return { command: "answer", answer: reviewPrompt.currentProfileValue };
					continue;
				}
				if (command === "e" || command === "edit") {
					const answer = (await rl.question("Exact run-scoped answer > ")).trim();
					if (answer) return { command: "answer", answer };
					console.error("Enter an answer, or choose another command.");
					continue;
				}
				console.error("Choose A, E, S, M, or Q.");
			}
		} finally {
			rl.close();
		}
	};
}

function buildPromptText(reviewPrompt) {
	const lines = [
		"Review required:",
		reviewPrompt.question,
	];
	if (reviewPrompt.options && reviewPrompt.options.length) {
		lines.push("");
		lines.push("Available answers:");
		for (const option of reviewPrompt.options) lines.push(`- ${option.label}`);
	}
	lines.push("");
	lines.push(reviewPrompt.message);
	lines.push(reviewPrompt.minimumInputRequired);
	if (reviewPrompt.currentProfileValue) lines.push("Accept uses the displayed suggestion only after confirmation.");
	lines.push("The browser will stay open while this prompt waits.");
	return lines.join("\n");
}

function normalizeProductStatus(result) {
	const status = result.status || "";
	const reason = result.reason || "";
	if (status === "awaiting-human-confirmation") return "ready-for-review";
	if (reason === "login-required" || status === "needs-user-confirmation") return "login-required";
	if (reason === "application-unavailable") return "application-unavailable";
	if (status === "needs-review") return "needs-review";
	if (["recovery-failed", "verification-failed", "max-cycles-reached"].includes(status)) return "failed";
	return status === "completed" ? "ready-for-review" : "failed";
}

function buildCompactRunArtifact({ url, profilePath, resumePath, coverLetterPath, result }) {
	const runtimeState = result.runtimeState || {};
	const lifecycle = result.lifecycle || [];
	const completedFields = Array.isArray(runtimeState.completedFields) ? runtimeState.completedFields : [];
	const reviewItems = Array.isArray(runtimeState.reviewItems) ? runtimeState.reviewItems : [];
	const decisionGateResults = Array.isArray(runtimeState.decisionGateResults) ? runtimeState.decisionGateResults : [];

	return {
		runId: "",
		url,
		status: result.productStatus || normalizeProductStatus(result),
		internalStatus: result.status,
		reason: result.reason || "",
		profilePath,
		configuredDocuments: {
			resume: Boolean(resumePath),
			coverLetter: Boolean(coverLetterPath),
		},
		filledFields: completedFields.map((field) => ({
			fieldFingerprint: field.fieldFingerprint || field.fingerprint || "",
			fieldIntent: field.fieldIntent || field.intent || "",
			label: field.label || "",
			controlType: field.controlType || "",
			selectedAnswer: field.value,
			profileSource: field.source || field.profilePath || "",
			resolutionMethod: field.resolutionMethod || field.source || "runtime-action",
			verificationOutcome: field.verification && field.verification.ok === false ? "failed" : "verified",
			userIntervened: field.source === "explicit-user-review",
		})),
		generatedAnswers: [],
		manualInterventions: reviewItems.map((item) => ({
			fieldIntent: item.fieldIntent || "",
			fieldFingerprint: item.fieldFingerprint || "",
			question: item.question || item.fieldLabel && item.fieldLabel.text || "",
			options: item.optionsSnapshot || item.options || [],
			reason: item.safetyReason || item.reason || "",
		})),
		failures: lifecycle
			.filter((entry) => entry.actionResult && entry.actionResult.verification && !entry.actionResult.verification.ok)
			.map((entry) => ({
				cycle: entry.cycle,
				category: "verification-failed",
				reason: entry.actionResult.verification.reason || "verification failed",
			})),
		safetyStops: decisionGateResults
			.filter((gate) => gate.type === "review-item" || String(gate.reason || "").includes("safety"))
			.map((gate) => ({
				reason: gate.reason || "",
				type: gate.type || "",
			})),
		finalSubmissionTriggered: runtimeState.finalSubmissionTriggered === true,
		submitted: runtimeState.finalSubmissionTriggered === true,
		metrics: buildRunMetrics({ runtimeState }),
	};
}

function buildRunMetrics({ runtimeState }) {
	const completedFields = Array.isArray(runtimeState.completedFields) ? runtimeState.completedFields : [];
	const skippedFields = Array.isArray(runtimeState.skippedFields) ? runtimeState.skippedFields : [];
	const encountered = Array.isArray(runtimeState.detectedFields) ? runtimeState.detectedFields : [];
	const allResolvedFields = completedFields.length + skippedFields.length;
	const directAliasFields = completedFields.filter((field) => field.resolutionMethod === "direct-alias").length;
	const codexSemanticFields = completedFields.filter((field) => field.resolutionMethod === "codex-semantic").length;
	const manualFields = completedFields.filter((field) => ["user-confirmed", "user-edited", "manual"].includes(field.resolutionMethod)).length;
	const verificationFailures = (runtimeState.decisionGateResults || []).filter((gate) => gate.reason === "verification-failed").length;

	return {
		denominators: {
			allResolvedFields,
			allEncounteredActionableFields: encountered.length,
		},
		directResolutionRate: allResolvedFields ? directAliasFields / allResolvedFields : 0,
		semanticResolutionRate: allResolvedFields ? codexSemanticFields / allResolvedFields : 0,
		manualInterventionRate: encountered.length ? manualFields / encountered.length : 0,
		incorrectFieldEntries: 0,
		verificationFailures,
		finalSubmissionTriggered: runtimeState.finalSubmissionTriggered === true,
	};
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
