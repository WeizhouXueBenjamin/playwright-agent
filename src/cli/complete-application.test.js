const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");

const { createReviewAnswerProvider, createReviewCheckpointProvider } = require("./complete-application");

async function main() {
	assert.equal(createReviewAnswerProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(createReviewCheckpointProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	await assertTerminalProviderWaitsForEdit();
	await assertCheckpointConsentProviderUsesTypedActions();
}

async function assertTerminalProviderWaitsForEdit() {
	const input = new PassThrough();
	input.isTTY = true;
	const output = new PassThrough();
	output.isTTY = true;
	const errorOutput = new PassThrough();
	let terminalText = "";
	let reviewText = "";
	output.on("data", (chunk) => { terminalText += chunk.toString(); });
	errorOutput.on("data", (chunk) => { reviewText += chunk.toString(); });

	const provider = createReviewAnswerProvider({ input, output, errorOutput });
	const answerPromise = provider({
		reviewPrompt: {
			question: "Do you accept this privacy policy?",
			options: [{ label: "Yes" }, { label: "No" }],
			currentProfileValue: "",
			message: "Explicit authorization is required.",
			minimumInputRequired: "Choose an answer.",
		},
	});

	const early = await Promise.race([
		answerPromise.then(() => "resolved"),
		delay(25).then(() => "pending"),
	]);
	assert.equal(early, "pending");
	input.write("e\nI agree\n");
	const answer = await answerPromise;

	assert.deepEqual(answer, {
		command: "answer",
		answer: "I agree",
		resolutionMethod: "user-edited",
	});
	assert.match(reviewText, /Review required:/);
	assert.match(terminalText, /\[A\]ccept \[E\]dit \[S\]kip \[M\]anual \[Q\]uit/);
	assert.match(terminalText, /Exact run-scoped answer/);
	input.destroy();
	output.destroy();
	errorOutput.destroy();
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

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
