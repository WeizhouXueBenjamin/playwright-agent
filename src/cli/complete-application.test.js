const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");

const {
	buildCompactRunArtifact,
	createFinalReviewProvider,
	createCliFinalReviewProvider,
	createCliManualLoginProvider,
	createManualLoginProvider,
	createReviewCheckpointProvider,
	formatCliError,
	formatFinalReviewSummary,
	formatRunSummary,
	normalizeProductStatus,
} = require("./complete-application");

async function main() {
	assert.equal(createReviewCheckpointProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(createFinalReviewProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(createManualLoginProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(normalizeProductStatus({ status: "needs-user-confirmation", reason: "recovery-needs-user-confirmation" }), "needs-review");
	assert.equal(normalizeProductStatus({ status: "needs-review", reason: "login-required" }), "login-required");
	assertCompactRunSummary();
	assertCompactCliError();
	assertFinalReviewArtifactIsBounded();
	assertManualLoginArtifactIsBounded();
	assertFinalReviewSummaryIsBounded();
	await assertFinalReviewOpensAndWaitsForAcknowledgement();
	await assertManualLoginEnterResumes();
	await assertManualLoginQuitStops();
	await assertManualLoginEofStops();
	await assertCheckpointConsentProviderUsesTypedActions();
	await assertCustomConsentRequiresOnlyOptionSelection();
	await assertManualValueCanBeEnteredDirectly();
	await assertOptionSelectionCanBeEnteredDirectly();
	await assertCheckpointQuitStillReturnsStop();
}

function assertManualLoginArtifactIsBounded() {
	const artifact = buildCompactRunArtifact({
		url: "https://example.test/apply",
		profilePath: "data/profile.json",
		resumePath: "",
		coverLetterPath: "",
		result: {
			status: "awaiting-human-confirmation",
			reason: "final-submission-control-detected",
			runtimeState: {},
			lifecycle: [{
				manualIntervention: {
					type: "manual-login",
					outcome: "resumed",
					attempts: 1,
					url: "https://accounts.example.test/?state=secret",
				},
			}],
		},
	});

	assert.deepEqual(artifact.manualInterventions, [{
		type: "manual-login",
		outcome: "resumed",
		attempts: 1,
	}]);
}

async function assertManualLoginEnterResumes() {
	const fixture = makeManualLoginProvider();
	const decisionPromise = fixture.provider({ attempt: 1, maxAttempts: 2, signal: new AbortController().signal });
	await waitFor(() => fixture.readErrorOutput().includes("Login required"), 2000);
	fixture.input.write("\n");
	assert.deepEqual(await decisionPromise, { action: "resume" });
	fixture.cleanup();
}

async function assertManualLoginQuitStops() {
	const fixture = makeManualLoginProvider();
	const decisionPromise = fixture.provider({ attempt: 1, maxAttempts: 2, signal: new AbortController().signal });
	await waitFor(() => fixture.readErrorOutput().includes("Login required"), 2000);
	fixture.input.write("q\n");
	assert.deepEqual(await decisionPromise, { action: "stop" });
	fixture.cleanup();
}

async function assertManualLoginEofStops() {
	const fixture = makeManualLoginProvider();
	const decisionPromise = fixture.provider({ attempt: 1, maxAttempts: 2, signal: new AbortController().signal });
	await waitFor(() => fixture.readErrorOutput().includes("Login required"), 2000);
	fixture.input.end();
	assert.deepEqual(await decisionPromise, { action: "stop" });
	fixture.cleanup();
}

function makeManualLoginProvider() {
	const input = new PassThrough();
	input.isTTY = true;
	const output = new PassThrough();
	output.isTTY = true;
	const errorOutput = new PassThrough();
	let errorText = "";
	errorOutput.on("data", (chunk) => { errorText += chunk.toString(); });
	return {
		provider: createCliManualLoginProvider({ input, output, errorOutput }),
		input,
		readErrorOutput: () => errorText,
		cleanup: () => cleanupStreams(input, output, errorOutput),
	};
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
	assert.match(text, /Ready for final review/);
	assert.match(text, /Browser is open/);
	assert.match(text, /The agent is paused and will not submit/);
	assert.match(text, /Review or submit manually, then press Enter to finish/);
	assert.doesNotMatch(text, /\[K\] Keep open|\[F\]|Final submission was|runtimeState|Aroha|65000/i);
}

async function assertFinalReviewOpensAndWaitsForAcknowledgement() {
	const { provider, input, output, errorOutput, readErrorOutput } = makeFinalReviewProvider();
	const decisionPromise = provider({
		summary: buildFinalReviewSummaryFixture(),
		signal: new AbortController().signal,
	});
	let settled = false;
	decisionPromise.then(() => { settled = true; });

	await waitFor(() => readErrorOutput().includes("Ready for final review"), 2000);
	assert.equal(settled, false);
	assert.match(readErrorOutput(), /Browser is open/);
	assert.doesNotMatch(readErrorOutput(), /\[K\] Keep open|\[F\] Finish|\[Q\]/);

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

	input.write("a\n");
	const decisions = await decisionsPromise;

	assert.deepEqual(decisions, [{ itemId: "review-privacy", action: "authorize" }]);
	assert.match(reviewText, /Recruitment Privacy Policy/);
	assert.match(reviewText, /\[A\] Authorize/);
	assert.match(reviewText, /\[D\] Decline/);
	assert.match(reviewText, /Continuing application/);
	assert.doesNotMatch(reviewText, /consent-authorization|Review decisions|\[R\]esume|Authorize this exact/i);
	assert.doesNotMatch(terminalText, /Edit|Accept|Submit|Authorize this exact|Resume/i);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

async function assertCustomConsentRequiresOnlyOptionSelection() {
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

	input.write("1\n");
	const decisions = await decisionsPromise;
	assert.deepEqual(decisions, [{
		itemId: "review-privacy",
		action: "authorize",
		value: "Acknowledge/Confirm",
	}]);
	assert.match(reviewText, /Recruitment Privacy Policy/);
	assert.match(reviewText, /1\. Acknowledge\/Confirm/);
	assert.match(reviewText, /Continuing application/);
	assert.doesNotMatch(terminalText, /Authorize selecting|y\/N|Resume/i);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

async function assertManualValueCanBeEnteredDirectly() {
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
	const reviewCheckpoint = {
		id: "checkpoint-manual-value",
		items: [{
			id: "review-value",
			type: "manual-value-required",
			fieldLabel: { text: "Salary expectation" },
			fieldState: { currentValue: "" },
			assessment: "Explicit value required.",
			options: [],
			allowedActions: ["provide-value", "manual", "skip", "stop"],
		}],
	};
	const decisionsPromise = provider({ reviewCheckpoint, runtimeState: { completedFields: [] } });

	input.write("65-75k\n");
	const decisions = await decisionsPromise;
	assert.deepEqual(decisions, [{ itemId: "review-value", action: "provide-value", value: "65-75k" }]);
	assert.match(reviewText, /Salary expectation/);
	assert.match(reviewText, /Continuing application/);
	assert.doesNotMatch(terminalText, /\[I\]nput value|Value >|\[R\]esume/i);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

async function assertOptionSelectionCanBeEnteredDirectly() {
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
	const reviewCheckpoint = {
		id: "checkpoint-location",
		items: [{
			id: "review-location",
			type: "option-selection",
			fieldLabel: { text: "Location" },
			fieldState: { currentValue: "" },
			assessment: "Choose one of the observed options.",
			options: [
				{ label: "Auckland, Auckland Region, New Zealand" },
				{ label: "Auckland Airport, Auckland Region, New Zealand" },
				{ label: "Auckland Central, Auckland Region, New Zealand" },
			],
			allowedActions: ["select", "manual", "skip", "stop"],
		}],
	};
	const decisionsPromise = provider({ reviewCheckpoint, runtimeState: { completedFields: [] } });

	input.write("1\n");
	const decisions = await decisionsPromise;
	assert.deepEqual(decisions, [{
		itemId: "review-location",
		action: "select",
		value: "Auckland, Auckland Region, New Zealand",
	}]);
	assert.match(reviewText, /Location/);
	assert.match(reviewText, /1\. Auckland, Auckland Region, New Zealand/);
	assert.match(reviewText, /Continuing application/);
	assert.doesNotMatch(terminalText, /Option number|Resume/i);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

async function assertCheckpointQuitStillReturnsStop() {
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

	input.write("q\n");
	const decisions = await decisionsPromise;
	assert.deepEqual(decisions, [{ itemId: "review-value", action: "stop" }]);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
