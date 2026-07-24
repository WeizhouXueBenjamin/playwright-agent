const VERIFICATION_RESULT_SCHEMA_VERSION = 1;

function buildVerificationResultContract(input) {
	const result = {
		schemaVersion: VERIFICATION_RESULT_SCHEMA_VERSION,
		ok: input.ok === true,
	};

	if (Object.prototype.hasOwnProperty.call(input, "expected")) result.expected = input.expected;
	if (Object.prototype.hasOwnProperty.call(input, "actual")) result.actual = input.actual;
	if (input.locatorStrategy) result.locatorStrategy = input.locatorStrategy;
	if (input.error) result.error = input.error;
	if (input.source) result.source = input.source;
	if (input.optionMatch) result.optionMatch = sanitizeOptionMatch(input.optionMatch);

	assertVerificationResultContract(result);
	return result;
}

function buildVerificationFailure(error) {
	return buildVerificationResultContract({
		ok: false,
		error: error && error.message ? error.message : String(error),
		source: "execution-error",
		optionMatch: error && error.optionMatch,
	});
}

function sanitizeOptionMatch(optionMatch) {
	if (!optionMatch || typeof optionMatch !== "object") return null;
	return {
		status: optionMatch.status || "",
		tier: optionMatch.tier || "",
		reason: optionMatch.reason || "",
		optionLabel: optionMatch.optionLabel || "",
		candidateCount: optionMatch.candidateCount || 0,
		candidates: (optionMatch.candidates || []).slice(0, 3).map((candidate) => ({
			label: candidate.label || "",
			score: candidate.score,
		})),
	};
}

function assertVerificationResultContract(result) {
	if (!result || typeof result !== "object") {
		throw new Error("VerificationResult must be an object.");
	}
	if (result.schemaVersion !== VERIFICATION_RESULT_SCHEMA_VERSION) {
		throw new Error(`Unsupported VerificationResult schemaVersion "${result.schemaVersion}".`);
	}
	if (typeof result.ok !== "boolean") {
		throw new Error("VerificationResult ok must be a boolean.");
	}
}

module.exports = {
	VERIFICATION_RESULT_SCHEMA_VERSION,
	assertVerificationResultContract,
	buildVerificationFailure,
	buildVerificationResultContract,
};
