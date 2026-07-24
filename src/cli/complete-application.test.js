const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");

const { createReviewCheckpointProvider, normalizeProductStatus } = require("./complete-application");

async function main() {
	assert.equal(createReviewCheckpointProvider({ input: { isTTY: false }, output: { isTTY: true } }), null);
	assert.equal(normalizeProductStatus({ status: "needs-user-confirmation", reason: "recovery-needs-user-confirmation" }), "needs-review");
	assert.equal(normalizeProductStatus({ status: "needs-review", reason: "login-required" }), "login-required");
	await assertCheckpointConsentProviderUsesTypedActions();
	await assertCustomConsentRequiresOptionAndAuthorization();
	await assertCheckpointSummaryQuitReturnsStop();
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
