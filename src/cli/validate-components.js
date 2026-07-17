const { validateApplicationComponents } = require("../validation/component-validation-runner");

async function main() {
	const [url] = process.argv.slice(2);

	if (!url) {
		throw new Error("Usage: npm run validate-components -- <job-application-url>");
	}

	const result = await validateApplicationComponents(new URL(url).toString());
	console.log(JSON.stringify({
		runDir: result.runDir,
		report: result.report,
	}, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
