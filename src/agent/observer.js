const { captureInteractiveElements } = require("../parsers/interactive-elements");
const { buildObservationContract } = require("../contracts/observation");
const { buildSemanticPage } = require("../reasoning/page-understanding");

async function observePage(page) {
	await installFinalSubmitObserver(page);
	const interactiveElements = await captureInteractiveElements(page);
	const semanticPage = buildSemanticPage({
		url: page.url(),
		title: await page.title(),
		interactiveElements,
		visibleText: await page.evaluate(() => String(document.body && document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000)),
	});
	semanticPage.finalSubmissionTriggered = await page.evaluate(() => Boolean(window.__jobAssistantFinalSubmissionTriggered));

	return buildObservationContract({
		semanticPage,
		fingerprint: buildPageFingerprint(semanticPage),
		sources: ["dom"],
	});
}

async function installFinalSubmitObserver(page) {
	await page.evaluate(() => {
		if (window.__jobAssistantSubmitObserverInstalled) return;
		window.__jobAssistantSubmitObserverInstalled = true;
		window.__jobAssistantFinalSubmissionTriggered = false;
		document.addEventListener("submit", () => {
			window.__jobAssistantFinalSubmissionTriggered = true;
		}, true);
	});
}

function buildPageFingerprint(semanticPage) {
	return JSON.stringify({
		url: semanticPage.url,
		finalSubmissionTriggered: semanticPage.finalSubmissionTriggered === true,
		fields: semanticPage.interactiveElements.map((element) => ({
			id: element.id,
			kind: element.kind,
			label: element.label && element.label.text,
			state: element.state,
			disabled: element.disabled,
		})),
	});
}

module.exports = {
	observePage,
};
