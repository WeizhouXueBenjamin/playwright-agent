function attachPageDiagnostics(page) {
	const consoleErrors = [];
	const networkErrors = [];

	page.on("console", (message) => {
		if (message.type() !== "error") return;

		consoleErrors.push({
			type: message.type(),
			text: message.text(),
			location: message.location(),
			observedAt: new Date().toISOString(),
		});
	});

	page.on("pageerror", (error) => {
		consoleErrors.push({
			type: "pageerror",
			text: error.message,
			location: {},
			observedAt: new Date().toISOString(),
		});
	});

	page.on("requestfailed", (request) => {
		const failure = request.failure();
		networkErrors.push({
			url: request.url(),
			method: request.method(),
			resourceType: request.resourceType(),
			errorText: failure ? failure.errorText : "",
			observedAt: new Date().toISOString(),
		});
	});

	page.on("response", (response) => {
		if (response.status() < 400) return;

		networkErrors.push({
			url: response.url(),
			method: response.request().method(),
			resourceType: response.request().resourceType(),
			status: response.status(),
			statusText: response.statusText(),
			observedAt: new Date().toISOString(),
		});
	});

	return {
		getDiagnostics() {
			return {
				consoleErrors: [...consoleErrors],
				networkErrors: [...networkErrors],
			};
		},
	};
}

module.exports = {
	attachPageDiagnostics,
};
