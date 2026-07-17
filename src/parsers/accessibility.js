async function captureAccessibilityTree(page) {
	const session = await page.context().newCDPSession(page);
	try {
		const result = await session.send("Accessibility.getFullAXTree");
		return result.nodes;
	} finally {
		await session.detach();
	}
}

module.exports = {
	captureAccessibilityTree,
};
