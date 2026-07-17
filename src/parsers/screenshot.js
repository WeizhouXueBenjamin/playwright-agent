async function captureScreenshot(page, path) {
	await page.screenshot({
		path,
		fullPage: true,
	});

	return path;
}

module.exports = {
	captureScreenshot,
};
