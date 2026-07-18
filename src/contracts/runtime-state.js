const RUNTIME_STATE_SCHEMA_VERSION = 1;

const FORBIDDEN_RUNTIME_STATE_KEYS = new Set([
	"assumption",
	"assumptions",
	"confidence",
	"confidenceScore",
	"reasoning",
	"speculation",
]);

function buildRuntimeStateContract(input) {
	const state = {
		...input,
		schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
	};

	assertRuntimeStateContract(state);
	return state;
}

function assertRuntimeStateContract(state) {
	if (!state || typeof state !== "object") {
		throw new Error("Runtime State must be an object.");
	}
	if (state.schemaVersion !== RUNTIME_STATE_SCHEMA_VERSION) {
		throw new Error(`Unsupported Runtime State schemaVersion "${state.schemaVersion}".`);
	}
	assertNoForbiddenRuntimeStateKeys(state);
}

function assertRuntimeStatePatchContract(patch) {
	if (!patch || typeof patch !== "object") {
		throw new Error("Runtime State patch must be an object.");
	}
	assertNoForbiddenRuntimeStateKeys(patch);
}

function assertNoForbiddenRuntimeStateKeys(value, path = "runtimeState") {
	if (!value || typeof value !== "object") return;

	if (Array.isArray(value)) {
		value.forEach((item, index) => assertNoForbiddenRuntimeStateKeys(item, `${path}[${index}]`));
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		if (FORBIDDEN_RUNTIME_STATE_KEYS.has(key)) {
			throw new Error(`Runtime State cannot contain "${key}" at ${path}.${key}.`);
		}
		assertNoForbiddenRuntimeStateKeys(child, `${path}.${key}`);
	}
}

module.exports = {
	RUNTIME_STATE_SCHEMA_VERSION,
	assertRuntimeStateContract,
	assertRuntimeStatePatchContract,
	buildRuntimeStateContract,
};
