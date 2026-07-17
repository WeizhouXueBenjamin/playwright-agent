const { captureInteractiveElements } = require("../parsers/interactive-elements");
const { buildSemanticPage } = require("../reasoning/page-understanding");

async function observePage(page) {
	const interactiveElements = await captureInteractiveElements(page);
	const semanticPage = buildSemanticPage({
		url: page.url(),
		title: await page.title(),
		interactiveElements,
	});

	return {
		semanticPage,
		fingerprint: buildPageFingerprint(semanticPage),
	};
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
