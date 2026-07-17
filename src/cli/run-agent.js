const fs = require("node:fs/promises");

const { AgentController } = require("../agent/controller");

async function main() {
	const [url, profilePath] = process.argv.slice(2);

	if (!url || !profilePath) {
		throw new Error("Usage: npm run agent -- <url> <profile.json>");
	}

	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const controller = new AgentController();
	const result = await controller.run(new URL(url).toString(), profile);
	console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
