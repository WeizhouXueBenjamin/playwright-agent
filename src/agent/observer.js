const { captureInteractiveElements } = require("../parsers/interactive-elements");
const { buildObservationContract } = require("../contracts/observation");
const { buildSemanticPage } = require("../reasoning/page-understanding");

async function observePage(page) {
	const interactiveElements = await captureInteractiveElements(page);
	const semanticPage = buildSemanticPage({
		url: page.url(),
		title: await page.title(),
		interactiveElements,
	});

	return buildObservationContract({
		semanticPage,
		fingerprint: buildPageFingerprint(semanticPage),
		sources: ["dom"],
	});
}

function buildPageFingerprint(semanticPage) {
	return JSON.stringify({
		url: semanticPage.url,
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
