const { compareBenchmarkReportFiles } = require("../benchmark/benchmark-comparison");

async function main() {
	const [baselinePath, candidatePath] = process.argv.slice(2);

	if (!baselinePath || !candidatePath) {
		throw new Error("Usage: npm run compare-benchmarks -- <baseline-report.json> <candidate-report.json>");
	}

	const comparison = await compareBenchmarkReportFiles(baselinePath, candidatePath);
	console.log(JSON.stringify(comparison, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
