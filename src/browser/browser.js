const { chromium } = require("playwright");

async function launchChromium(options = {}) {
	const { headless = true } = options;

	return chromium.launch({
		headless,
	});
}

module.exports = {
	launchChromium,
};
