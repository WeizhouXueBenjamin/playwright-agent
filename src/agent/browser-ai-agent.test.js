const assert = require("node:assert/strict");

const { BrowserAIAgent } = require("./browser-ai-agent");

async function main() {
	const agent = new BrowserAIAgent({ maxCycles: 20 });
	const result = await agent.completeJobApplication({
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
	});

	assert.equal(result.status, "awaiting-human-confirmation");
	assert.equal(result.reason, "final-submission-control-detected");
	assert.equal(result.runtimeState.goal, "Complete the job application and stop before final submission.");
	assert.equal(result.runtimeState.completedFields.some((field) => field.profilePropertyPath === "resumePath"), true);
	assert.equal(result.runtimeState.completedFields.some((field) => field.profilePropertyPath === "coverLetterPath"), true);
	assert.equal(result.runtimeState.completedActions.some((action) => action.action === "upload-file"), true);
	assert.equal(result.decisionLog.some((entry) => entry.action && entry.action.type === "upload-file"), true);
	assert.equal(result.decisionLog.some((entry) => entry.decision && entry.decision.reasoning === "Handle cookie-banner."), true);
	assert.equal(JSON.stringify(result.runtimeState).includes("reasoning"), false);
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
		"document.querySelector('#continue').addEventListener('click', () => {",
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

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
