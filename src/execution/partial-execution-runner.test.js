const assert = require("node:assert/strict");

const { runPartialExecution } = require("./partial-execution-runner");

async function main() {
	await assertPartialExecutionReport();
	await assertStopsBeforeExternalAuthentication();
}

async function assertPartialExecutionReport() {
	const result = await runPartialExecution({
		url: createApplicationUrl(),
		profile: {
			firstName: "Aroha",
			lastName: "Smith",
			email: "aroha@example.com",
			country: "New Zealand",
			agreement: true,
		},
		resume: __filename,
		coverLetter: __filename,
		options: { maxCycles: 20 },
	});

	assert.equal(result.status, "awaiting-human-confirmation");
	assert.equal(result.report.mode, "partial-execution");
	assert.equal(result.report.humanConfirmationRequired, true);
	assert.equal(result.report.stoppedBeforeIrreversibleAction, true);
	assert.equal(result.report.summary.executedActionCount > 0, true);
	assert.equal(result.report.summary.retryCount, 1);
	assert.equal(result.report.summary.verificationFailureCount, 1);
	assert.equal(result.report.executedActions.some((action) => action.action === "upload-file"), true);
	assert.equal(result.report.verificationResults.some((verification) => !verification.ok), true);
	assert.equal(result.report.verificationResults.some((verification) => verification.ok), true);
	assert.equal(result.report.runtimeTimeline.length > 0, true);
	assert.equal(result.report.finalRuntimeState.currentExecutionStatus, "awaiting-human-confirmation");
	assert.equal(result.report.finalRuntimeState.completedActions.some((action) => action.action === "click" && action.fieldLabel.text === "Submit application"), false);
	assert.equal(JSON.stringify(result.report.finalRuntimeState).includes("reasoning"), false);
	assert.equal(JSON.stringify(result.report.runtimeTimeline).includes("confidence"), false);
}

async function assertStopsBeforeExternalAuthentication() {
	const result = await runPartialExecution({
		url: createExternalAuthenticationUrl(),
		profile: {},
		options: { maxCycles: 5 },
	});

	assert.equal(result.status, "awaiting-human-confirmation");
	assert.equal(result.report.humanConfirmationRequired, true);
	assert.equal(result.reason, "irreversible-action-needs-confirmation");
	assert.equal(result.report.summary.executedActionCount, 0);
}

function createApplicationUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<div id=\"cookie\">We use cookies. <button type=\"button\">Accept cookies</button></div>",
		"<form>",
		"<section id=\"step-1\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<label for=\"last\">Last name</label>",
		"<input id=\"last\" name=\"lastName\" required>",
		"<label for=\"email\">Email address</label>",
		"<input id=\"email\" name=\"email\" type=\"email\" required>",
		"<label><input type=\"checkbox\" name=\"agreement\" required> I agree</label>",
		"<button type=\"button\" id=\"continue\">Continue</button>",
		"</section>",
		"<section id=\"step-2\" hidden>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\" required>",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"<label for=\"resume\">Resume</label>",
		"<input id=\"resume\" name=\"resume\" type=\"file\" required>",
		"<label for=\"cover\">Cover letter</label>",
		"<input id=\"cover\" name=\"coverLetter\" type=\"file\" required>",
		"<button type=\"submit\">Submit application</button>",
		"</section>",
		"</form>",
		"<script>",
		"document.querySelector('#cookie button').addEventListener('click', () => document.querySelector('#cookie').remove());",
		"let continueClicks = 0;",
		"document.querySelector('#continue').addEventListener('click', () => {",
		"continueClicks += 1;",
		"if (continueClicks < 2) return;",
		"if (![...document.querySelectorAll('#step-1 input')].every((input) => input.reportValidity())) return;",
		"document.querySelector('#step-1').hidden = true;",
		"document.querySelector('#step-2').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createExternalAuthenticationUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<main>",
		"<p>Use an external identity provider to continue.</p>",
		"<button type=\"button\">Continue with Google</button>",
		"</main>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
