const PROFILE_PROPERTY_ALIASES = {
	firstName: ["first name", "given name", "forename"],
	lastName: ["last name", "surname", "family name"],
	fullName: ["full name", "legal name", "name"],
	preferredName: ["preferred name", "chosen name", "nickname"],
	email: ["email", "email address", "e-mail"],
	phone: ["phone", "phone number", "mobile", "mobile phone", "telephone"],
	address: ["address", "street address"],
	city: ["city", "town"],
	state: ["state", "province", "region"],
	postalCode: ["postal code", "postcode", "zip", "zip code"],
	country: ["country", "country of residence"],
	linkedIn: ["linkedin", "linkedin profile", "linkedin url"],
	website: ["website", "personal website", "portfolio", "portfolio url"],
	github: ["github", "github profile", "github url"],
	resume: ["resume", "cv", "curriculum vitae"],
	resumePath: ["resume", "cv", "curriculum vitae", "resume file", "upload resume"],
	coverLetter: ["cover letter"],
	coverLetterPath: ["cover letter", "cover letter file", "upload cover letter"],
	agreement: ["agreement", "agree", "consent"],
	salaryExpectation: ["salary expectation", "salary expectations", "expected salary", "desired salary", "compensation expectation", "expected compensation", "hourly rate", "desired hourly rate"],
	currentSalary: ["current salary", "current compensation", "current pay"],
	workAuthorization: ["work authorization", "authorized to work", "right to work"],
	requiresSponsorship: ["sponsorship", "visa sponsorship", "require sponsorship"],
	visaType: ["visa type", "visa status", "immigration status"],
	consentAuthorization: ["privacy policy", "privacy consent", "consent authorization", "data processing consent"],
	legalDeclarationAuthorization: ["legal declaration", "declaration authorization", "certification authorization"],
	referralSource: ["referral source", "how did you hear about us", "how heard"],
	company: ["company", "employer", "organization"],
	jobTitle: ["job title", "title", "position", "role"],
	school: ["school", "university", "college", "institution"],
	degree: ["degree", "qualification"],
	major: ["major", "field of study", "area of study"],
};

function listProfileProperties(profile) {
	return flattenProfile(profile).map((property) => ({
		...property,
		searchPhrases: buildSearchPhrases(property.path),
	}));
}

function flattenProfile(value, path = []) {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) => flattenProfile(item, [...path, String(index)]));
	}

	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, child]) => flattenProfile(child, [...path, key]));
	}

	if (!path.length) return [];

	return [
		{
			path: path.join("."),
			key: path[path.length - 1],
			value,
			valueType: value === null ? "null" : typeof value,
			valuePresent: value !== undefined && value !== null && String(value).trim() !== "",
		},
	];
}

function buildSearchPhrases(path) {
	const segments = path.split(".").filter((segment) => !/^\d+$/.test(segment));
	const key = segments[segments.length - 1] || "";
	const aliases = PROFILE_PROPERTY_ALIASES[key] || [];
	const pathPhrases = [
		key,
		splitIdentifier(key),
		segments.join(" "),
		segments.map(splitIdentifier).join(" "),
	];

	return uniqueStrings([...aliases, ...pathPhrases]).filter(Boolean);
}

function splitIdentifier(value) {
	return String(value)
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.toLowerCase()
		.trim();
}

function uniqueStrings(values) {
	const seen = new Set();
	const result = [];

	for (const value of values) {
		const normalized = String(value).replace(/\s+/g, " ").trim().toLowerCase();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}

	return result;
}

module.exports = {
	listProfileProperties,
};
