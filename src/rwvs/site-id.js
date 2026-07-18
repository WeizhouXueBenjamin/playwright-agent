function createWebsiteId(input) {
	if (input.websiteId) return sanitizeId(input.websiteId);

	try {
		const url = new URL(input.url);
		return sanitizeId(url.hostname.replace(/^www\./i, ""));
	} catch {
		return "unknown-website";
	}
}

function sanitizeId(value) {
	return String(value || "unknown-website")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "unknown-website";
}

module.exports = {
	createWebsiteId,
	sanitizeId,
};
