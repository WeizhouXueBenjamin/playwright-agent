const path = require("node:path");

const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { createRunLogDir, writeJsonArtifact, writeTextArtifact } = require("../logging/artifact-store");
const { captureAccessibilityTree } = require("../parsers/accessibility");
const { captureHtml } = require("../parsers/dom");
const { captureInteractiveElements } = require("../parsers/interactive-elements");
const { captureScreenshot } = require("../parsers/screenshot");
const { buildSemanticPage } = require("../reasoning/page-understanding");

async function capturePageArtifacts(url, options = {}) {
	const { runId, runDir } = await createRunLogDir(options.logsDir);
	const browser = await launchChromium({ headless: options.headless });

	try {
		const { context, page } = await openPage(browser, url, options);
		try {
			const stability = await waitForPageStable(page, options.stability);
			const html = await captureHtml(page);
			const accessibilityTree = await captureAccessibilityTree(page);
			const interactiveElements = await captureInteractiveElements(page);
			const semanticPage = buildSemanticPage({
				url: page.url(),
				title: await page.title(),
				interactiveElements,
			});
			const screenshotPath = path.join(runDir, "screenshot.png");
			await captureScreenshot(page, screenshotPath);

			const manifest = {
				runId,
				requestedUrl: url,
				finalUrl: page.url(),
				title: semanticPage.title,
				capturedAt: new Date().toISOString(),
				stability,
				artifacts: {
					html: "page.html",
					accessibilityTree: "accessibility-tree.json",
					semanticPage: "semantic-page.json",
					screenshot: "screenshot.png",
					manifest: "manifest.json",
				},
			};

			await writeTextArtifact(runDir, "page.html", html);
			await writeJsonArtifact(runDir, "accessibility-tree.json", accessibilityTree);
			await writeJsonArtifact(runDir, "semantic-page.json", semanticPage);
			await writeJsonArtifact(runDir, "manifest.json", manifest);

			return {
				runDir,
				manifest,
			};
		} finally {
			await context.close();
		}
	} finally {
		await browser.close();
	}
}

module.exports = {
	capturePageArtifacts,
};
