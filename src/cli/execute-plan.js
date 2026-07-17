const fs = require("node:fs/promises");

const { executePlan } = require("../agent/executor");

async function main() {
	const [url, planPath] = process.argv.slice(2);

	if (!url || !planPath) {
		throw new Error("Usage: npm run execute-plan -- <url> <execution-plan.json>");
	}

	const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
	const result = await executePlan(new URL(url).toString(), plan);
	console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
