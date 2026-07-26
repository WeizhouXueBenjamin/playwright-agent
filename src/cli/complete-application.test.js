const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");

const {
	buildCompactRunArtifact,
	createFinalReviewProvider,
	createCliFinalReviewProvider,
	createReviewCheckpointProvider,
	formatCliError,
	formatFinalReviewSummary,
	formatRunSummary,
	normalizeProductStatus,
} = require("./complete-application");

async function main() {
	assert.equal(createReviewCheckpointProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(createFinalReviewProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(normalizeProductStatus({ status: "needs-user-confirmation", reason: "recovery-needs-user-confirmation" }), "needs-review");
	assert.equal(normalizeProductStatus({ status: "needs-review", reason: "login-required" }), "login-required");
	assertCompactRunSummary();
	assertCompactCliError();
	assertFinalReviewArtifactIsBounded();
	assertFinalReviewSummaryIsBounded();
	await assertFinalReviewFinishReturnsLifecycleOnly();
	await assertFinalReviewKeepOpenWaitsForAcknowledgement();
	await assertFinalReviewStopReturnsLifecycleOnly();
	await assertCheckpointConsentProviderUsesTypedActions();
	await assertCustomConsentRequiresOptionAndAuthorization();
	await assertCheckpointSummaryQuitReturnsStop();
}

function buildFinalReviewSummaryFixture() {
	return {
		status: "ready-for-review",
		reason: "final-submission-control-detected",
		verifiedFields: 11,
		reviewDecisionsApplied: 3,
		skippedFields: 1,
		pendingReviewItems: 0,
		finalSubmissionTriggered: false,
	};
}

function assertFinalReviewArtifactIsBounded() {
	const artifact = buildCompactRunArtifact({
		url: "https://example.test/apply",
		profilePath: "data/profile.json",
		resumePath: "",
		coverLetterPath: "",
		result: {
			productStatus: "ready-for-review",
			status: "awaiting-human-confirmation",
			reason: "final-submission-control-detected",
			finalReview: {
				interactive: true,
				state: "manual-review-complete",
				automatedActionsPerformed: false,
				manualSubmissionOutcome: "unknown",
			},
			runtimeState: {
				completedFields: [{ label: "First name", value: "Aroha" }],
				skippedFields: [],
				manualReview: [],
				decisionGateResults: [],
				finalSubmissionTriggered: false,
			},
			lifecycle: [],
		},
	});

	assert.equal(artifact.status, "ready-for-review");
	assert.deepEqual(artifact.finalReview, {
		interactive: true,
		state: "manual-review-complete",
		automatedActionsPerformed: false,
		manualSubmissionOutcome: "unknown",
	});
	assert.equal(artifact.finalSubmissionTriggered, false);
	assert.equal(artifact.submitted, false);
}

function assertFinalReviewSummaryIsBounded() {
	const text = formatFinalReviewSummary(buildFinalReviewSummaryFixture());
	assert.match(text, /Application ready for final review/);
	assert.match(text, /Automation is complete and permanently paused/);
	assert.match(text, /Final submission was not triggered/);
	assert.match(text, /\[K\] Keep open/);
	assert.doesNotMatch(text, /Submit application|Accept and submit|runtimeState|Aroha|65000/i);
}

async function assertFinalReviewFinishReturnsLifecycleOnly() {
	const { provider, input, output, errorOutput } = makeFinalReviewProvider();
	const decisionPromise = provider({
		summary: buildFinalReviewSummaryFixture(),
		signal: new AbortController().signal,
	});

	input.write("f\n");
	const decision = await decisionPromise;
	assert.deepEqual(decision, { action: "finish-without-submit" });
	cleanupStreams(input, output, errorOutput);
}

async function assertFinalReviewStopReturnsLifecycleOnly() {
	const { provider, input, output, errorOutput } = makeFinalReviewProvider();
	const decisionPromise = provider({
		summary: buildFinalReviewSummaryFixture(),
		signal: new AbortController().signal,
	});

	input.write("q\n");
	const decision = await decisionPromise;
	assert.deepEqual(decision, { action: "stop" });
	cleanupStreams(input, output, errorOutput);
}

async function assertFinalReviewKeepOpenWaitsForAcknowledgement() {
	const { provider, input, output, errorOutput, readErrorOutput } = makeFinalReviewProvider();
	const decisionPromise = provider({
		summary: buildFinalReviewSummaryFixture(),
		signal: new AbortController().signal,
	});
	let settled = false;
	decisionPromise.then(() => { settled = true; });

	input.write("k\n");
	await waitFor(() => readErrorOutput().includes("Manual review mode active"), 2000);
	assert.equal(settled, false);
	assert.match(readErrorOutput(), /Manual review mode active/);

	input.write("\n");
	const decision = await decisionPromise;
	assert.deepEqual(decision, { action: "keep-open" });
	cleanupStreams(input, output, errorOutput);
}

function makeFinalReviewProvider() {
	const input = new PassThrough();
	input.isTTY = true;
	const output = new PassThrough();
	output.isTTY = true;
	const errorOutput = new PassThrough();
	let errorText = "";
	errorOutput.on("data", (chunk) => { errorText += chunk.toString(); });
	return {
		provider: createCliFinalReviewProvider({ input, output, errorOutput }),
		input,
		output,
		errorOutput,
		readErrorOutput: () => errorText,
	};
}

function cleanupStreams(...streams) {
	for (const stream of streams) stream.destroy();
}

async function waitFor(predicate, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for condition.");
}

function assertCompactRunSummary() {
	const summary = formatRunSummary({
		productStatus: "ready-for-review",
		status: "awaiting-human-confirmation",
		reason: "final-submission-control-detected",
		runtimeState: {
			completedFields: Array.from({ length: 11 }, (_, index) => ({ fieldId: `field-${index}` })),
			skippedFields: [{ fieldId: "degree" }],
			reviewAnswers: [{ answer: "Auckland" }, { answer: "Acknowledge/Confirm" }, { answer: "65-75k" }],
			pendingReviewCheckpoint: null,
			finalSubmissionTriggered: false,
		},
		lifecycle: [{ runtimeStateSnapshot: { large: "x".repeat(10000) } }],
	}, "logs/apply/run-test/run-artifact.json");

	assert.match(summary, /Status: ready-for-review/);
	assert.match(summary, /Verified fields: 11/);
	assert.match(summary, /Review decisions applied: 3/);
	assert.match(summary, /Final submission: not triggered/);
	assert.match(summary, /run-artifact\.json/);
	assert.doesNotMatch(summary, /runtimeState|lifecycle|large/);
	assert.ok(summary.length < 600, `Expected compact summary, received ${summary.length} characters.`);
}

function assertCompactCliError() {
	const error = new Error("Unable to associate a visible listbox with the active control.");
	error.details = { page: "x".repeat(10000) };
	const summary = formatCliError(error);

	assert.match(summary, /Application run failed/);
	assert.match(summary, /Unable to associate a visible listbox/);
	assert.doesNotMatch(summary, /details|page/);
	assert.ok(summary.length < 500, `Expected compact error, received ${summary.length} characters.`);
}

async function assertCheckpointConsentProviderUsesTypedActions() {
	const input = new PassThrough();
	input.isTTY = true;
	const output = new PassThrough();
	output.isTTY = true;
	const errorOutput = new PassThrough();
	let terminalText = "";
	let reviewText = "";
	output.on("data", (chunk) => { terminalText += chunk.toString(); });
	errorOutput.on("data", (chunk) => { reviewText += chunk.toString(); });

	const provider = createReviewCheckpointProvider({ input, output, errorOutput });
	const decisionsPromise = provider({
		reviewCheckpoint: {
			id: "checkpoint-test",
			items: [
				{
					id: "review-privacy",
					type: "consent-authorization",
					fieldLabel: { text: "Recruitment Privacy Policy" },
					fieldState: { currentValue: false },
					assessment: "This required checkbox represents acceptance of the recruitment privacy policy.",
					options: [],
					allowedActions: ["authorize", "decline", "stop"],
				},
			],
		},
		runtimeState: { completedFields: [{ fieldId: "first" }] },
	});

	input.write("a\ny\nr\n");
	const decisions = await decisionsPromise;

	assert.deepEqual(decisions, [{ itemId: "review-privacy", action: "authorize" }]);
	assert.match(reviewText, /Recruitment Privacy Policy - consent-authorization/);
	assert.match(terminalText, /\[A\]uthorize \[D\]ecline \[Q\]uit/);
	assert.doesNotMatch(terminalText, /Edit|Accept|Submit/i);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

async function assertCustomConsentRequiresOptionAndAuthorization() {
	const input = new PassThrough();
	input.isTTY = true;
	const output = new PassThrough();
	output.isTTY = true;
	const errorOutput = new PassThrough();
	let terminalText = "";
	output.on("data", (chunk) => { terminalText += chunk.toString(); });
	const provider = createReviewCheckpointProvider({ input, output, errorOutput });
	const reviewCheckpoint = {
		id: "checkpoint-custom-consent",
		items: [{
			id: "review-privacy",
			type: "consent-authorization",
			fieldLabel: { text: "Recruitment Privacy Policy" },
			fieldState: { currentValue: "" },
			assessment: "Explicit authorization required.",
			options: [{ label: "Acknowledge/Confirm" }],
			allowedActions: ["authorize", "manual", "decline", "stop"],
		}],
	};
	const decisionsPromise = provider({ reviewCheckpoint, runtimeState: { completedFields: [] } });

	input.write("1\ny\nr\n");
	const decisions = await decisionsPromise;
	assert.deepEqual(decisions, [{
		itemId: "review-privacy",
		action: "authorize",
		value: "Acknowledge/Confirm",
	}]);
	assert.match(terminalText, /Option number/);
	assert.match(terminalText, /Authorize selecting "Acknowledge\/Confirm"/);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

async function assertCheckpointSummaryQuitReturnsStop() {
	const input = new PassThrough();
	input.isTTY = true;
	const output = new PassThrough();
	output.isTTY = true;
	const errorOutput = new PassThrough();
	const provider = createReviewCheckpointProvider({ input, output, errorOutput });
	const reviewCheckpoint = {
		id: "checkpoint-quit",
		items: [{
			id: "review-value",
			type: "manual-value-required",
			fieldLabel: { text: "Expected salary" },
			fieldState: { currentValue: "" },
			assessment: "Explicit value required.",
			options: [],
			allowedActions: ["provide-value", "manual", "skip", "stop"],
		}],
	};
	const decisionsPromise = provider({ reviewCheckpoint, runtimeState: { completedFields: [] } });

	input.write("i\n120000\nq\n");
	const decisions = await decisionsPromise;
	assert.deepEqual(decisions, [{ itemId: "__checkpoint", action: "stop" }]);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
