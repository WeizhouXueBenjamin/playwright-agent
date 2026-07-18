const BENCHMARK_REPORT_SCHEMA_VERSION = 1;

function assertBenchmarkReportContract(report) {
	if (!report || typeof report !== "object") {
		throw new Error("BenchmarkReport must be an object.");
	}
	if (report.schemaVersion !== BENCHMARK_REPORT_SCHEMA_VERSION) {
		throw new Error(`Unsupported BenchmarkReport schemaVersion "${report.schemaVersion}".`);
	}
	if (!report.mode) {
		throw new Error("BenchmarkReport mode is required.");
	}
	if (!report.summary || typeof report.summary !== "object") {
		throw new Error("BenchmarkReport summary is required.");
	}
	if (!Array.isArray(report.caseResults)) {
		throw new Error("BenchmarkReport caseResults must be an array.");
	}
}

module.exports = {
	BENCHMARK_REPORT_SCHEMA_VERSION,
	assertBenchmarkReportContract,
};
