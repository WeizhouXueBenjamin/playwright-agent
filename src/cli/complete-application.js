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
	return async ({ reviewPrompt }) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		try {
			console.error("");
			console.error(reviewPrompt.question ? buildPromptText(reviewPrompt) : "Review required.");
			while (true) {
				const answer = (await rl.question("> ")).trim();
				if (answer.toLowerCase() === "/stop") {
					throw new Error("Apply workflow stopped by user during review.");
				}
				if (answer) return { answer };
				console.error("Enter an answer to continue, or /stop to stop the workflow.");
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
	lines.push("The browser will stay open while this prompt waits. Enter /stop to stop.");
	return lines.join("\n");
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
		status: result.status,
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
		submitted: false,
	};
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
