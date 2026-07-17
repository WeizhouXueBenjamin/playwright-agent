async function openPage(browser, url, options = {}) {
	const {
		viewport = { width: 1365, height: 900 },
		navigationTimeoutMs = 45000,
	} = options;

	const context = await browser.newContext({ viewport });
	const page = await context.newPage();
	page.setDefaultNavigationTimeout(navigationTimeoutMs);
	page.setDefaultTimeout(navigationTimeoutMs);

	await page.goto(url, {
		waitUntil: "domcontentloaded",
		timeout: navigationTimeoutMs,
	});

	return { context, page };
}

module.exports = {
	openPage,
};
