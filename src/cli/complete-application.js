const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");

const { BrowserAIAgent } = require("../agent/browser-ai-agent");
const { createRunLogDir, writeJsonArtifact } = require("../logging/artifact-store");
const { REVIEW_TYPES } = require("../review/review-types");

const DEFAULT_PROFILE_PATH = path.join("data", "profile-full-stack.json");

async function main() {
	const [url, profilePath = DEFAULT_PROFILE_PATH, resumePath = "", coverLetterPath = ""] = process.argv.slice(2);

	if (!url) {
		throw new Error("Usage: npm run apply -- <url> [profile.json] [resume] [cover-letter]");
	}

	const reviewCheckpointProvider = createReviewCheckpointProvider({
		input: process.stdin,
		output: process.stdout,
		errorOutput: process.stderr,
	});
	const finalReviewProvider = createFinalReviewProvider({
		input: process.stdin,
		output: process.stdout,
		errorOutput: process.stderr,
	});
	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const { runId, runDir } = await createRunLogDir(path.join("logs", "apply"));
	const agent = new BrowserAIAgent({
		headless: false,
		persistent: true,
		userDataDir: path.resolve(".playwright", "apply-profile"),
		reviewCheckpointProvider,
		finalReviewProvider,
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
	compactArtifact.runId = runId;
	const artifactPath = await writeJsonArtifact(runDir, "run-artifact.json", compactArtifact);

	console.log(formatRunSummary(result, artifactPath));
}

function createReviewCheckpointProvider(options = {}) {
	if (!options.input || options.input.isTTY !== true || !options.output || options.output.isTTY !== true) {
		return null;
	}
	return createCliReviewCheckpointProvider(options);
}

function createCliReviewCheckpointProvider(options = {}) {
	const input = options.input || process.stdin;
	const output = options.output || process.stdout;
	const errorOutput = options.errorOutput || process.stderr;
	return async ({ reviewCheckpoint, runtimeState }) => {
		const rl = readline.createInterface({ input, output });
		try {
			errorOutput.write(formatCheckpointSummary(reviewCheckpoint, runtimeState));
			const decisions = [];
			const items = reviewCheckpoint.items || [];
			for (let index = 0; index < items.length; index += 1) {
				const item = items[index];
				const decision = await askCheckpointItem({
					rl,
					item,
					errorOutput,
					position: items.length > 1 ? { index: index + 1, total: items.length } : null,
				});
				decisions.push({ itemId: item.id, ...decision });
				if (decision.action === "stop") return decisions;
			}
			errorOutput.write("\nContinuing application...\n\n");
			return decisions;
		} finally {
			rl.close();
		}
	};
}

function createFinalReviewProvider(options = {}) {
	if (!options.input || options.input.isTTY !== true || !options.output || options.output.isTTY !== true) {
		return null;
	}
	return createCliFinalReviewProvider(options);
}

function createCliFinalReviewProvider(options = {}) {
	const input = options.input || process.stdin;
	const output = options.output || process.stdout;
	const errorOutput = options.errorOutput || process.stderr;
	return async ({ summary, signal }) => {
		const rl = readline.createInterface({ input, output });
		try {
			errorOutput.write(formatFinalReviewSummary(summary));
			await askFinalReviewQuestion(rl, "", signal);
			return { action: "keep-open" };
		} finally {
			rl.close();
		}
	};
}

async function askFinalReviewQuestion(rl, prompt, signal) {
	try {
		return await rl.question(prompt, { signal });
	} catch {
		return "";
	}
}

async function askCheckpointItem({ rl, item, errorOutput, position = null }) {
	errorOutput.write(formatCheckpointItem(item, position));
	while (true) {
		const command = (await rl.question(promptForItem(item))).trim();
		const decision = await parseItemDecision({ rl, item, command, errorOutput });
		if (decision) return decision;
	}
}

async function parseItemDecision({ rl, item, command, errorOutput }) {
	const normalized = command.toLowerCase();
	if (normalized === "q" || normalized === "stop") return { action: "stop" };

	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION) {
		if ((item.options || []).length) {
			const optionIndex = Number(normalized);
			if (Number.isInteger(optionIndex) && optionIndex >= 1 && optionIndex <= item.options.length) {
				const selectedOption = item.options[optionIndex - 1];
				return { action: "authorize", value: selectedOption.label };
			}
			if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
			if (normalized === "d" || normalized === "decline") return { action: "decline" };
			errorOutput.write(`Choose an option number from 1 to ${item.options.length}, M, D, or Q.\n`);
			return null;
		}
		if (item.controlType === "selection") {
			if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
			if (normalized === "d" || normalized === "decline") return { action: "decline" };
			errorOutput.write("Options could not be safely inspected. Choose M, D, or Q.\n");
			return null;
		}
		if (normalized === "a" || normalized === "authorize") {
			return { action: "authorize" };
		}
		if (normalized === "d" || normalized === "decline") return { action: "decline" };
		errorOutput.write("Choose A, D, or Q.\n");
		return null;
	}

	if (item.type === REVIEW_TYPES.CONFIRM_PROPOSED_VALUE) {
		if (normalized === "c" || normalized === "confirm") return { action: "confirm" };
		if (normalized === "r" || normalized === "replace") {
			const value = (await rl.question("Replacement value > ")).trim();
			return value ? { action: "replace", value } : null;
		}
		if (normalized === "s" || normalized === "skip") return { action: "skip" };
		if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
		errorOutput.write("Choose C, R, M, S, or Q.\n");
		return null;
	}

	if (item.type === REVIEW_TYPES.OPTION_SELECTION) {
		const optionIndex = Number(normalized);
		if (Number.isInteger(optionIndex) && optionIndex >= 1 && optionIndex <= item.options.length) {
			return { action: "select", value: item.options[optionIndex - 1].label };
		}
		if (normalized === "p" || normalized === "prefer-not-to-answer") return { action: "prefer-not-to-answer" };
		if (normalized === "s" || normalized === "skip") return { action: "skip" };
		if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
		errorOutput.write("Choose an option number, P, M, S, or Q.\n");
		return null;
	}

	if (item.type === REVIEW_TYPES.FILE_REQUIRED) {
		if (normalized === "f" || normalized === "file") {
			const value = (await rl.question("Configured file path > ")).trim();
			return value ? { action: "provide-file", value } : null;
		}
		if (normalized === "s" || normalized === "skip") return { action: "skip" };
		if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
		errorOutput.write("Choose F, M, S, or Q.\n");
		return null;
	}

	if (normalized === "s" || normalized === "skip") return { action: "skip" };
	if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
	if (command) return { action: "provide-value", value: command };
	errorOutput.write("Enter a value, M, S, or Q.\n");
	return null;
}

async function askForManualCompletion(rl, errorOutput) {
	errorOutput.write("Complete this field in the open browser, then press Enter here.\n");
	await rl.question("");
	return { action: "manual" };
}

function formatFinalReviewSummary(summary = {}) {
	return [
		"",
		"Ready for final review",
		"",
		"Browser is open.",
		"The agent is paused and will not submit.",
		"",
		"Review or submit manually, then press Enter to finish.",
		"",
	].join("\n");
}

function formatCheckpointSummary(reviewCheckpoint, runtimeState = {}) {
	const count = (reviewCheckpoint.items || []).length;
	if (count <= 1) return "\n";
	return `\n${count} items need your input\n\n`;
}

function formatCheckpointItem(item, position = null) {
	const lines = [
		position ? `${position.index}/${position.total} ${item.fieldLabel.text}` : item.fieldLabel.text,
	];
	if (item.proposedValue) lines.push(`Suggested answer: ${item.proposedValue}`);
	if (item.options && item.options.length) {
		item.options.forEach((option, index) => lines.push(`${index + 1}. ${option.label}`));
	}
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION && !(item.options || []).length) {
		lines.push("[A] Authorize", "[D] Decline");
	}
	return `${lines.join("\n")}\n`;
}

function promptForItem(item) {
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION && (item.options || []).length) {
		return "> ";
	}
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION && item.controlType === "selection") {
		return "[M]anual [D]ecline [Q]uit > ";
	}
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION) return "> ";
	if (item.type === REVIEW_TYPES.CONFIRM_PROPOSED_VALUE) return "[C]onfirm [R]eplace [M]anual [S]kip [Q]uit > ";
	if (item.type === REVIEW_TYPES.OPTION_SELECTION) return "> ";
	if (item.type === REVIEW_TYPES.FILE_REQUIRED) return "[F]ile path [M]anual [S]kip [Q]uit > ";
	return "> ";
}

function normalizeProductStatus(result) {
	const status = result.status || "";
	const reason = result.reason || "";
	if (status === "awaiting-human-confirmation") return "ready-for-review";
	if (reason === "login-required") return "login-required";
	if (reason === "application-unavailable") return "application-unavailable";
	if (status === "needs-user-confirmation") return "needs-review";
	if (status === "needs-review") return "needs-review";
	if (["recovery-failed", "verification-failed", "max-cycles-reached"].includes(status)) return "failed";
	return status === "completed" ? "ready-for-review" : "failed";
}

function buildCompactRunArtifact({ url, profilePath, resumePath, coverLetterPath, result }) {
	const runtimeState = result.runtimeState || {};
	const lifecycle = result.lifecycle || [];
	const completedFields = Array.isArray(runtimeState.completedFields) ? runtimeState.completedFields : [];
	const reviewItems = Array.isArray(runtimeState.manualReview) ? runtimeState.manualReview : [];
	const decisionGateResults = Array.isArray(runtimeState.decisionGateResults) ? runtimeState.decisionGateResults : [];

	return {
		runId: "",
		url,
		status: result.productStatus || normalizeProductStatus(result),
		internalStatus: result.status,
		reason: result.reason || "",
		pendingReviewCheckpoint: runtimeState.pendingReviewCheckpoint ? summarizeCheckpoint(runtimeState.pendingReviewCheckpoint) : null,
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
				field: entry.actionResult.step && entry.actionResult.step.field && entry.actionResult.step.field.label || null,
				controlType: entry.actionResult.step && entry.actionResult.step.field && entry.actionResult.step.field.kind || "",
				optionMatch: summarizeOptionMatch(entry.actionResult.verification.optionMatch),
			})),
		safetyStops: decisionGateResults
			.filter((gate) => gate.type === "review-item" || String(gate.reason || "").includes("safety"))
			.map((gate) => ({
				reason: gate.reason || "",
				type: gate.type || "",
			})),
		...(result.finalReview ? { finalReview: result.finalReview } : {}),
		finalSubmissionTriggered: runtimeState.finalSubmissionTriggered === true,
		submitted: runtimeState.finalSubmissionTriggered === true,
		metrics: buildRunMetrics({ runtimeState }),
	};
}

function summarizeCheckpoint(checkpoint) {
	return {
		id: checkpoint.id,
		status: checkpoint.status,
		reason: checkpoint.reason,
		pageUrl: checkpoint.pageUrl,
		pageTitle: checkpoint.pageTitle,
		items: (checkpoint.items || []).map((item) => ({
			id: item.id,
			type: item.type,
			fieldFingerprint: item.fieldFingerprint,
			fieldLabel: item.fieldLabel,
			controlType: item.controlType,
			fieldIntent: item.fieldIntent,
			reasonCode: item.reasonCode,
			allowedActions: item.allowedActions,
			options: item.options,
			optionMatch: item.optionMatch || null,
			metadata: item.metadata,
		})),
	};
}

function summarizeOptionMatch(optionMatch) {
	if (!optionMatch) return null;
	return {
		tier: optionMatch.tier || "",
		reason: optionMatch.reason || "",
		candidateCount: optionMatch.candidateCount || 0,
		candidates: (optionMatch.candidates || []).slice(0, 3).map((candidate) => ({
			label: candidate.label || "",
			score: candidate.score,
		})),
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

function formatRunSummary(result = {}, artifactPath = "") {
	const runtimeState = result.runtimeState || {};
	const completedFields = Array.isArray(runtimeState.completedFields) ? runtimeState.completedFields : [];
	const skippedFields = Array.isArray(runtimeState.skippedFields) ? runtimeState.skippedFields : [];
	const reviewAnswers = Array.isArray(runtimeState.reviewAnswers) ? runtimeState.reviewAnswers : [];
	const pendingItems = runtimeState.pendingReviewCheckpoint && Array.isArray(runtimeState.pendingReviewCheckpoint.items)
		? runtimeState.pendingReviewCheckpoint.items.length
		: 0;
	const status = result.productStatus || normalizeProductStatus(result);
	const lines = [
		"",
		"Application run complete",
		`Status: ${status}`,
		`Reason: ${formatRunReason(result.reason)}`,
		`Verified fields: ${completedFields.length}`,
		`Review decisions applied: ${reviewAnswers.length}`,
		`Skipped fields: ${skippedFields.length}`,
		`Pending review items: ${pendingItems}`,
		`Final submission: ${runtimeState.finalSubmissionTriggered === true ? "triggered" : "not triggered"}`,
	];
	if (artifactPath) lines.push(`Run artifact: ${artifactPath}`);
	return lines.join("\n");
}

function formatRunReason(reason) {
	const normalized = String(reason || "").trim();
	if (normalized === "final-submission-control-detected") return "stopped before final submission";
	if (!normalized) return "run completed";
	return truncateTerminalText(normalized, 240);
}

function formatCliError(error) {
	const name = error && error.name && error.name !== "Error" ? `${error.name}: ` : "";
	const message = error && error.message ? error.message : String(error || "Unknown error");
	return [
		"Application run failed",
		`Reason: ${name}${truncateTerminalText(message, 320)}`,
		"Set APPLY_DEBUG=1 to print the stack trace.",
	].join("\n");
}

function truncateTerminalText(value, maxLength) {
	const normalized = String(value || "").replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength - 3)}...`;
}

if (require.main === module) {
	main().catch((error) => {
		console.error(process.env.APPLY_DEBUG === "1" ? error && error.stack || error : formatCliError(error));
		process.exitCode = 1;
	});
}

module.exports = {
	buildCompactRunArtifact,
	createCliFinalReviewProvider,
	createCliReviewCheckpointProvider,
	createFinalReviewProvider,
	createReviewCheckpointProvider,
	formatFinalReviewSummary,
	formatCliError,
	formatRunSummary,
	normalizeProductStatus,
};
