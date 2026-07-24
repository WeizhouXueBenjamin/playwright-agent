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
	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const { runId, runDir } = await createRunLogDir(path.join("logs", "apply"));
	const agent = new BrowserAIAgent({
		headless: false,
		persistent: true,
		userDataDir: path.resolve(".playwright", "apply-profile"),
		reviewCheckpointProvider,
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

	console.error(`Run artifact: ${artifactPath}`);
	console.log(JSON.stringify(result, null, 2));
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
			for (const item of reviewCheckpoint.items || []) {
				const decision = await askCheckpointItem({ rl, item, errorOutput });
				decisions.push({ itemId: item.id, ...decision });
				if (decision.action === "stop") return decisions;
			}
			errorOutput.write(formatDecisionSummary(reviewCheckpoint, decisions));
			while (true) {
				const command = (await rl.question("[R]esume application [Q]uit > ")).trim().toLowerCase();
				if (command === "q" || command === "quit") return [{ action: "stop", itemId: "__checkpoint" }];
				if (command === "r" || command === "resume") return decisions;
				errorOutput.write("Choose R or Q.\n");
			}
		} finally {
			rl.close();
		}
	};
}

async function askCheckpointItem({ rl, item, errorOutput }) {
	errorOutput.write(formatCheckpointItem(item));
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
				const confirm = (await rl.question(`Authorize selecting "${selectedOption.label}" for this exact current statement and run? [y/N] `)).trim().toLowerCase();
				if (confirm === "y" || confirm === "yes") return { action: "authorize", value: selectedOption.label };
				return null;
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
			const confirm = (await rl.question("Authorize this exact current statement for this run? [y/N] ")).trim().toLowerCase();
			if (confirm === "y" || confirm === "yes") return { action: "authorize" };
			return null;
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

	if (normalized === "i" || normalized === "input" || normalized === "provide-value") {
		const value = (await rl.question("Value > ")).trim();
		return value ? { action: "provide-value", value } : null;
	}
	if (normalized === "s" || normalized === "skip") return { action: "skip" };
	if (normalized === "m" || normalized === "manual") return askForManualCompletion(rl, errorOutput);
	errorOutput.write("Choose I, M, S, or Q.\n");
	return null;
}

async function askForManualCompletion(rl, errorOutput) {
	errorOutput.write("Complete this field in the open browser, then press Enter here.\n");
	await rl.question("");
	return { action: "manual" };
}

function formatCheckpointSummary(reviewCheckpoint, runtimeState = {}) {
	return [
		"\nHuman review checkpoint",
		"",
		"Completed automatically:",
		`- ${(runtimeState.completedFields || []).length} verified fields`,
		`- 0 final submission actions`,
		"",
		"Pending review:",
		...(reviewCheckpoint.items || []).map((item, index) => `${index + 1}. ${item.fieldLabel.text} - ${item.type}`),
		"",
		"The browser remains open. No page actions will occur until you confirm the batch.",
		"",
	].join("\n");
}

function formatCheckpointItem(item) {
	const lines = [
		`[${item.id}] ${item.fieldLabel.text}`,
		`Type: ${item.type}`,
		`Current state: ${formatCurrentState(item.fieldState.currentValue)}`,
		`Agent assessment: ${item.assessment}`,
	];
	if (item.proposedValue) lines.push(`Suggested answer: ${item.proposedValue}`);
	if (item.options && item.options.length) {
		lines.push("Options:");
		item.options.forEach((option, index) => lines.push(`[${index + 1}] ${option.label}`));
	}
	return `${lines.join("\n")}\n`;
}

function promptForItem(item) {
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION && (item.options || []).length) {
		return "Option number, [M]anual, [D]ecline, [Q]uit > ";
	}
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION && item.controlType === "selection") {
		return "[M]anual [D]ecline [Q]uit > ";
	}
	if (item.type === REVIEW_TYPES.CONSENT_AUTHORIZATION) return "[A]uthorize [D]ecline [Q]uit > ";
	if (item.type === REVIEW_TYPES.CONFIRM_PROPOSED_VALUE) return "[C]onfirm [R]eplace [M]anual [S]kip [Q]uit > ";
	if (item.type === REVIEW_TYPES.OPTION_SELECTION) return "Option number, [P]refer not, [M]anual, [S]kip, [Q]uit > ";
	if (item.type === REVIEW_TYPES.FILE_REQUIRED) return "[F]ile path [M]anual [S]kip [Q]uit > ";
	return "[I]nput value [M]anual [S]kip [Q]uit > ";
}

function formatDecisionSummary(reviewCheckpoint, decisions) {
	const lines = ["", "Review decisions", ""];
	for (const decision of decisions) {
		const item = (reviewCheckpoint.items || []).find((candidate) => candidate.id === decision.itemId);
		if (!item) continue;
		lines.push(`${item.id}. ${item.fieldLabel.text}: ${decision.action}`);
	}
	lines.push("");
	return lines.join("\n");
}

function formatCurrentState(value) {
	if (Array.isArray(value)) return value.length ? value.join(", ") : "Empty";
	if (value === true) return "Selected";
	if (value === false) return "Not selected";
	return value ? String(value) : "Empty";
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

if (require.main === module) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}

module.exports = {
	buildCompactRunArtifact,
	createCliReviewCheckpointProvider,
	createReviewCheckpointProvider,
	normalizeProductStatus,
};
