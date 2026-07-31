const { runBenchmark } = require("../benchmark/benchmark-runner");

async function main() {
	const [datasetPath] = process.argv.slice(2);

	if (!datasetPath) {
		throw new Error("Usage: pnpm benchmark -- <dataset.json>");
	}

	const result = await runBenchmark(datasetPath);
	console.log(JSON.stringify(result.report, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
