const fs = require("node:fs/promises");

const { BrowserAIAgent } = require("../agent/browser-ai-agent");

async function main() {
	const [url, profilePath, resumePath = "", coverLetterPath = ""] = process.argv.slice(2);

	if (!url || !profilePath) {
		throw new Error("Usage: npm run complete-application -- <url> <profile.json> [resume] [cover-letter]");
	}

	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const agent = new BrowserAIAgent();
	const result = await agent.completeJobApplication({
		url: new URL(url).toString(),
		profile,
		resume: resumePath,
		coverLetter: coverLetterPath,
	});

	console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
