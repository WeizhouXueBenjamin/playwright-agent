const OBSERVATION_SCHEMA_VERSION = 1;

function buildObservationContract(input) {
	const observation = {
		schemaVersion: OBSERVATION_SCHEMA_VERSION,
		mode: "browser-observation",
		semanticPage: input.semanticPage,
		fingerprint: input.fingerprint,
		sources: input.sources || ["dom"],
	};

	assertObservationContract(observation);
	return observation;
}

function assertObservationContract(observation) {
	if (!observation || typeof observation !== "object") {
		throw new Error("Observation must be an object.");
	}
	if (observation.schemaVersion !== OBSERVATION_SCHEMA_VERSION) {
		throw new Error(`Unsupported Observation schemaVersion "${observation.schemaVersion}".`);
	}
	if (!observation.semanticPage || typeof observation.semanticPage !== "object") {
		throw new Error("Observation requires semanticPage.");
	}
	if (typeof observation.semanticPage.url !== "string") {
		throw new Error("Observation semanticPage.url must be a string.");
	}
	if (typeof observation.fingerprint !== "string") {
		throw new Error("Observation fingerprint must be a string.");
	}
	if (!Array.isArray(observation.sources)) {
		throw new Error("Observation sources must be an array.");
	}
}

module.exports = {
	OBSERVATION_SCHEMA_VERSION,
	assertObservationContract,
	buildObservationContract,
};
