const fs = require("node:fs/promises");

const { matchFieldsToProfile } = require("../reasoning/field-matching");

async function main() {
	const [semanticPagePath, profilePath] = process.argv.slice(2);

	if (!semanticPagePath || !profilePath) {
		throw new Error("Usage: pnpm match-fields -- <semantic-page.json> <profile.json>");
	}

	const [semanticPage, profile] = await Promise.all([
		readJson(semanticPagePath),
		readJson(profilePath),
	]);

	const matches = matchFieldsToProfile(semanticPage, profile);
	console.log(JSON.stringify(matches, null, 2));
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, "utf8"));
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
