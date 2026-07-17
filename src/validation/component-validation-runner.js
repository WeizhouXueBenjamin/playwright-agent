const path = require("node:path");

const { collectObservationBenchmark } = require("../benchmark/benchmark-collector");
const { writeJsonArtifact } = require("../logging/artifact-store");
const { validateComponents } = require("./component-validator");
const { buildValidationReport } = require("./validation-report");

async function validateApplicationComponents(url, options = {}) {
	const benchmark = await collectObservationBenchmark(url, {
		...options,
		logsDir: options.logsDir || "logs/component-validation",
	});
	const semanticPagePath = path.join(benchmark.runDir, benchmark.report.artifacts.semanticPage);
	const semanticPage = requireFreshJson(semanticPagePath);
	const componentValidation = validateComponents(semanticPage);
	const artifacts = {
		...benchmark.report.artifacts,
		componentValidation: "component-validation.json",
		validationReport: "validation-report.json",
	};
	const report = buildValidationReport({
		runId: benchmark.report.runId,
		requestedUrl: url,
		observationReport: benchmark.report,
		componentValidation,
		artifacts,
	});

	await writeJsonArtifact(benchmark.runDir, artifacts.componentValidation, componentValidation);
	await writeJsonArtifact(benchmark.runDir, artifacts.validationReport, report);

	return {
		runDir: benchmark.runDir,
		report,
	};
}

function requireFreshJson(filePath) {
	delete require.cache[require.resolve(filePath)];
	return require(filePath);
}

module.exports = {
	validateApplicationComponents,
};
