const fs = require("node:fs/promises");

const { runRealWebsiteValidation } = require("../rwvs/rwvs-runner");

async function main() {
	const [inputPath] = process.argv.slice(2);

	if (!inputPath) {
		throw new Error("Usage: npm run rwvs -- <input.json>");
	}

	const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
	const result = await runRealWebsiteValidation(input);
	console.log(JSON.stringify(result.report, null, 2));

	if (result.report.result === "REGRESSION") {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
