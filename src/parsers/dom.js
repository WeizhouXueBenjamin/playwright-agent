async function captureHtml(page) {
	return page.content();
}

module.exports = {
	captureHtml,
};
