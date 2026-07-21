const { chromium } = require("playwright");

async function launchChromium(options = {}) {
	const { headless = true } = options;

	return chromium.launch({
		headless,
	});
}

async function launchPersistentChromiumContext(options = {}) {
	const {
		headless = true,
		userDataDir,
		viewport = { width: 1365, height: 900 },
	} = options;

	if (!userDataDir) {
		throw new Error("Persistent Chromium context requires userDataDir.");
	}

	return chromium.launchPersistentContext(userDataDir, {
		headless,
		viewport,
	});
}

module.exports = {
	launchChromium,
	launchPersistentChromiumContext,
};
