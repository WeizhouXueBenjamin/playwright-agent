const { capturePageArtifacts } = require("../agent/browser-foundation");

async function main() {
	const url = process.argv[2];

	if (!url) {
		throw new Error("Usage: pnpm capture -- <url>");
	}

	const parsedUrl = new URL(url);
	const result = await capturePageArtifacts(parsedUrl.toString());

	console.log(`Captured ${result.manifest.finalUrl}`);
	console.log(`Artifacts: ${result.runDir}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
