const fs = require("node:fs/promises");

const { runPartialExecution } = require("../execution/partial-execution-runner");

async function main() {
	const [url, profilePath, resumePath = "", coverLetterPath = ""] = process.argv.slice(2);

	if (!url || !profilePath) {
		throw new Error("Usage: npm run partial-execution -- <url> <profile.json> [resume] [cover-letter]");
	}

	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const result = await runPartialExecution({
		url: new URL(url).toString(),
		profile,
		resume: resumePath,
		coverLetter: coverLetterPath,
	});

	console.log(JSON.stringify(result.report, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
