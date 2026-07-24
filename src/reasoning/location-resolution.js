const LOCATION_INTENTS = {
	CITY: "city",
	COUNTRY: "country",
	CITY_AND_COUNTRY: "city-and-country",
	REGION: "region-state",
	POSTCODE: "postcode",
	FULL_ADDRESS: "full-address",
	CURRENT_LOCATION: "current-location",
	RELOCATION: "relocation-preference",
	UNKNOWN: "unknown",
};

function classifyLocationIntent(field = {}) {
	const text = getFieldText(field);

	if (/\b(relocat(e|ion)|willing to relocate)\b/.test(text)) return LOCATION_INTENTS.RELOCATION;
	if (/\b(current location|where are you located|where do you live)\b/.test(text)) return LOCATION_INTENTS.CURRENT_LOCATION;
	if (/\b(postcode|postal code|zip code|zip)\b/.test(text)) return LOCATION_INTENTS.POSTCODE;
	if (/\b(address|street address)\b/.test(text)) return LOCATION_INTENTS.FULL_ADDRESS;
	if (/\b(state|province|region|county)\b/.test(text)) return LOCATION_INTENTS.REGION;
	if (/\bcity\b/.test(text) && /\bcountry\b/.test(text)) return LOCATION_INTENTS.CITY_AND_COUNTRY;
	if (/\bcity|town|location\b/.test(text)) return LOCATION_INTENTS.CITY;
	if (/\bcountry\b/.test(text)) return LOCATION_INTENTS.COUNTRY;
	return LOCATION_INTENTS.UNKNOWN;
}

function resolveLocationProfileProperty(field, profile = {}) {
	if (field.kind === "file-upload") return null;
	const intent = classifyLocationIntent(field);
	const location = profile.location && typeof profile.location === "object" ? profile.location : {};

	const values = {
		[LOCATION_INTENTS.CITY]: [location.city, profile.city],
		[LOCATION_INTENTS.COUNTRY]: [location.country, profile.country],
		[LOCATION_INTENTS.CITY_AND_COUNTRY]: [
			location.formatted,
			formatCityCountry(location.city || profile.city, location.country || profile.country),
		],
		[LOCATION_INTENTS.REGION]: [location.region, location.state, profile.region, profile.state],
		[LOCATION_INTENTS.POSTCODE]: [location.postcode, location.postalCode, profile.postcode, profile.postalCode],
		[LOCATION_INTENTS.FULL_ADDRESS]: [location.formattedAddress, profile.address],
		[LOCATION_INTENTS.CURRENT_LOCATION]: [
			location.formatted,
			formatCityCountry(location.city || profile.city, location.country || profile.country),
			location.city,
			profile.city,
		],
	};

	const value = firstPresent(values[intent] || []);
	if (!value) return null;

	const result = {
		path: getLocationPath(intent, profile, location),
		value,
		valueType: typeof value,
		valuePresent: true,
		locationIntent: intent,
		source: "structured-location",
	};
	const country = firstPresent([location.country, profile.country]);
	if (intent === LOCATION_INTENTS.CITY && country) result.selectionContext = { country };
	return result;
}

function getLocationPath(intent, profile, location) {
	if (intent === LOCATION_INTENTS.CITY && location.city) return "location.city";
	if (intent === LOCATION_INTENTS.COUNTRY && location.country) return "location.country";
	if (intent === LOCATION_INTENTS.REGION && (location.region || location.state)) return location.region ? "location.region" : "location.state";
	if (intent === LOCATION_INTENTS.POSTCODE && (location.postcode || location.postalCode)) return location.postcode ? "location.postcode" : "location.postalCode";
	if (intent === LOCATION_INTENTS.CITY_AND_COUNTRY && location.formatted) return "location.formatted";
	if (intent === LOCATION_INTENTS.CURRENT_LOCATION && location.formatted) return "location.formatted";
	return {
		[LOCATION_INTENTS.CITY]: "city",
		[LOCATION_INTENTS.COUNTRY]: "country",
		[LOCATION_INTENTS.CITY_AND_COUNTRY]: "location.formatted",
		[LOCATION_INTENTS.REGION]: profile.region ? "region" : "state",
		[LOCATION_INTENTS.POSTCODE]: profile.postcode ? "postcode" : "postalCode",
		[LOCATION_INTENTS.FULL_ADDRESS]: "address",
		[LOCATION_INTENTS.CURRENT_LOCATION]: profile.city ? "city" : "location.formatted",
	}[intent] || "location";
}

function getFieldText(field) {
	return [
		field.label && field.label.text,
		...(field.labelCandidates || [])
			.filter((candidate) => ["label", "aria-label", "aria-labelledby", "placeholder", "fieldset-legend"].includes(candidate.source))
			.map((candidate) => candidate.text),
		field.placeholder,
	].map((value) => String(value || "").toLowerCase()).join(" ");
}

function formatCityCountry(city, country) {
	if (city && country) return `${city}, ${country}`;
	return city || country || "";
}

function firstPresent(values) {
	return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

module.exports = {
	LOCATION_INTENTS,
	classifyLocationIntent,
	resolveLocationProfileProperty,
};
