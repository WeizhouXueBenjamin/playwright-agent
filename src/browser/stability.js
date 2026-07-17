async function waitForPageStable(page, options = {}) {
	const {
		networkIdleTimeoutMs = 10000,
		domQuietMs = 700,
		domStableTimeoutMs = 10000,
	} = options;

	await page.waitForLoadState("domcontentloaded");

	let networkIdleReached = true;
	try {
		await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs });
	} catch {
		networkIdleReached = false;
	}

	const domStable = await waitForDomQuiet(page, domQuietMs, domStableTimeoutMs);

	return {
		networkIdleReached,
		domStable,
		domQuietMs,
	};
}

async function waitForDomQuiet(page, quietMs, timeoutMs) {
	return page.evaluate(
		({ quietMs, timeoutMs }) =>
			new Promise((resolve) => {
				let settled = false;
				let quietTimer;

				const finish = (result) => {
					if (settled) return;
					settled = true;
					clearTimeout(quietTimer);
					observer.disconnect();
					resolve(result);
				};

				const restartQuietTimer = () => {
					clearTimeout(quietTimer);
					quietTimer = setTimeout(() => finish(true), quietMs);
				};

				const observer = new MutationObserver(restartQuietTimer);
				observer.observe(document.documentElement, {
					attributes: true,
					childList: true,
					subtree: true,
					characterData: true,
				});

				restartQuietTimer();
				setTimeout(() => finish(false), timeoutMs);
			}),
		{ quietMs, timeoutMs },
	);
}

module.exports = {
	waitForPageStable,
};
