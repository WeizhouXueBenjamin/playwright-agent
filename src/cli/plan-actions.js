const fs = require("node:fs/promises");

const { buildExecutionPlan } = require("../agent/planner");

async function main() {
	const [matchesPath] = process.argv.slice(2);

	if (!matchesPath) {
		throw new Error("Usage: npm run plan-actions -- <field-matches.json>");
	}

	const matches = await readJson(matchesPath);
	const plan = buildExecutionPlan(matches);
	console.log(JSON.stringify(plan, null, 2));
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
