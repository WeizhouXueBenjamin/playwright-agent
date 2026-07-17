const fs = require("node:fs/promises");
const path = require("node:path");

async function loadBenchmarkDataset(datasetPath) {
	const absolutePath = path.resolve(datasetPath);
	const dataset = JSON.parse(await fs.readFile(absolutePath, "utf8"));
	validateDataset(dataset, absolutePath);

	return {
		...dataset,
		sourcePath: absolutePath,
		cases: await Promise.all(dataset.cases.map((benchmarkCase) => normalizeCase(benchmarkCase, absolutePath))),
	};
}

function validateDataset(dataset, datasetPath) {
	if (!dataset || typeof dataset !== "object") {
		throw new Error(`Benchmark dataset must be a JSON object: ${datasetPath}`);
	}

	if (!Array.isArray(dataset.cases) || dataset.cases.length === 0) {
		throw new Error(`Benchmark dataset must contain at least one case: ${datasetPath}`);
	}

	for (const benchmarkCase of dataset.cases) {
		if (!benchmarkCase.id) throw new Error("Benchmark case is missing id.");
		if (!benchmarkCase.url) throw new Error(`Benchmark case ${benchmarkCase.id} is missing url.`);
	}
}

async function normalizeCase(benchmarkCase, datasetPath) {
	const datasetDir = path.dirname(datasetPath);
	const profile = benchmarkCase.profile || await readOptionalJson(resolveOptionalPath(datasetDir, benchmarkCase.profilePath));

	return {
		id: benchmarkCase.id,
		name: benchmarkCase.name || benchmarkCase.id,
		url: benchmarkCase.url,
		profile: profile || {},
		resume: resolveOptionalPath(datasetDir, benchmarkCase.resumePath || benchmarkCase.resume),
		coverLetter: resolveOptionalPath(datasetDir, benchmarkCase.coverLetterPath || benchmarkCase.coverLetter),
		tags: benchmarkCase.tags || [],
		notes: benchmarkCase.notes || "",
		options: benchmarkCase.options || {},
	};
}

async function readOptionalJson(filePath) {
	if (!filePath) return null;
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function resolveOptionalPath(baseDir, maybePath) {
	if (!maybePath) return "";
	if (/^https?:\/\//i.test(maybePath) || maybePath.startsWith("data:")) return maybePath;
	return path.resolve(baseDir, maybePath);
}

module.exports = {
	loadBenchmarkDataset,
};
