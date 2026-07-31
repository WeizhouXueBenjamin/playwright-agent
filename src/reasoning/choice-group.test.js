const assert = require("node:assert/strict");

const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { observePage } = require("../agent/observer");

async function main() {
	const browser = await launchChromium();
	try {
		const { context, page } = await openPage(browser, createChoiceGroupPageUrl());
		try {
			await waitForPageStable(page);
			const observation = await observePage(page);
			const groups = observation.semanticPage.choiceGroups;

			assert.equal(groups.length, 4);
			assert.deepEqual(groups.map((group) => ({
				mode: group.mode,
				question: group.question,
				rule: group.rule,
				members: group.memberIds.length,
			})), [
				{ mode: "single", question: "Highest qualification", rule: "native-name", members: 3 },
				{ mode: "multiple", question: "Technologies used", rule: "fieldset", members: 2 },
				{ mode: "single", question: "Working arrangement", rule: "aria-group", members: 2 },
				{ mode: "single", question: "Preferred schedule", rule: "shared-aria-labelledby", members: 2 },
			]);

			const ungrouped = observation.semanticPage.interactiveElements
				.filter((element) => ["Standalone A", "Standalone B"].includes(element.label.text));
			assert.equal(ungrouped.every((element) => !element.choiceGroupId), true);
		} finally {
			await context.close();
		}
	} finally {
		await browser.close();
	}
}

function createChoiceGroupPageUrl() {
	const html = [
		"<!doctype html><html><body><form>",
		"<fieldset><legend>Highest qualification</legend>",
		"<label><input type=\"radio\" name=\"qualification\" value=\"bachelor\">Bachelor</label>",
		"<label><input type=\"radio\" name=\"qualification\" value=\"master\">Master</label>",
		"<label><input type=\"radio\" name=\"qualification\" value=\"phd\">PhD</label>",
		"</fieldset>",
		"<fieldset><legend>Technologies used</legend>",
		"<label><input type=\"checkbox\" value=\"react\">React</label>",
		"<label><input type=\"checkbox\" value=\"aws\">AWS</label>",
		"</fieldset>",
		"<div role=\"radiogroup\" aria-label=\"Working arrangement\">",
		"<div role=\"radio\" aria-label=\"Remote\" aria-checked=\"false\" tabindex=\"0\">Remote</div>",
		"<div role=\"radio\" aria-label=\"Office\" aria-checked=\"false\" tabindex=\"0\">Office</div>",
		"</div>",
		"<p id=\"schedule-question\">Preferred schedule</p>",
		"<label><input type=\"radio\" aria-labelledby=\"schedule-question\" value=\"full-time\">Full time</label>",
		"<label><input type=\"radio\" aria-labelledby=\"schedule-question\" value=\"part-time\">Part time</label>",
		"<label><input type=\"checkbox\">Standalone A</label>",
		"<label><input type=\"checkbox\">Standalone B</label>",
		"</form></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
