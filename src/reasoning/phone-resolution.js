function resolvePhoneProfileProperty(field = {}, profile = {}) {
	const intent = classifyPhoneIntent(field);
	if (intent === "unknown") return null;

	const phone = String(profile.phone || "").trim();
	const parsed = parseInternationalPhone(phone);
	if (!parsed) return unresolvedPhoneProperty(intent);

	if (intent === "country-code") {
		return buildPhoneProperty("phone.countryCode", parsed.countryCode, intent);
	}
	if (intent === "primary-number") {
		return buildPhoneProperty("phone.localNumber", parsed.localNumber, intent);
	}
	return unresolvedPhoneProperty(intent);
}

function classifyPhoneIntent(field = {}) {
	const identifier = [field.name, field.domId, field.id].map(normalize).join(" ");
	const label = normalize(field.label && field.label.text);
	if (/\b(ah|after.?hours)[_-]?phone\b/.test(identifier) || /\ba\/?h\b|after hours/.test(label)) {
		return "secondary-number";
	}
	if (/phone[_-]?country|country[_-]?(code|prefix)|dial[_-]?code/.test(identifier)
		|| /\b(country|dial) code\b/.test(label)) {
		return "country-code";
	}
	if (/\b(day|mobile|cell)[_-]?phone\b|\bphone\b/.test(identifier)
		|| /\bmobile|cell phone|phone number\b/.test(label)) {
		return "primary-number";
	}
	return "unknown";
}

function parseInternationalPhone(value) {
	const match = String(value || "").trim().match(/^\+(\d{1,3})[\s()-]+(.+)$/);
	if (!match) return null;
	const localNumber = match[2].replace(/\D/g, "");
	if (!localNumber) return null;
	return { countryCode: match[1], localNumber };
}

function buildPhoneProperty(path, value, phoneIntent) {
	return {
		path,
		value,
		valueType: "string",
		valuePresent: true,
		phoneIntent,
		source: "structured-phone",
	};
}

function unresolvedPhoneProperty(phoneIntent) {
	return {
		path: "phone",
		value: "",
		valueType: "string",
		valuePresent: false,
		phoneIntent,
		source: "structured-phone-unresolved",
	};
}

function normalize(value) {
	return String(value || "").trim().toLowerCase();
}

module.exports = {
	classifyPhoneIntent,
	parseInternationalPhone,
	resolvePhoneProfileProperty,
};
