const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");

const { BrowserAIAgent } = require("../agent/browser-ai-agent");

async function main() {
	const [url, profilePath, resumePath = "", coverLetterPath = ""] = process.argv.slice(2);

	if (!url || !profilePath) {
		throw new Error("Usage: npm run complete-application -- <url> <profile.json> [resume] [cover-letter]");
	}

	const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
	const agent = new BrowserAIAgent({
		headless: false,
		persistent: true,
		userDataDir: path.resolve(".playwright", "apply-profile"),
		reviewAnswerProvider: process.stdin.isTTY ? createCliReviewAnswerProvider() : null,
	});
	const result = await agent.completeJobApplication({
		url: new URL(url).toString(),
		profile,
		resume: resumePath,
		coverLetter: coverLetterPath,
	});

	console.log(JSON.stringify(result, null, 2));
}

function createCliReviewAnswerProvider() {
	return async ({ reviewPrompt }) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		try {
			console.error("");
			console.error(reviewPrompt.question ? buildPromptText(reviewPrompt) : "Review required.");
			while (true) {
				const answer = (await rl.question("> ")).trim();
				if (answer.toLowerCase() === "/stop") {
					throw new Error("Apply workflow stopped by user during review.");
				}
				if (answer) return { answer };
				console.error("Enter an answer to continue, or /stop to stop the workflow.");
			}
		} finally {
			rl.close();
		}
	};
}

function buildPromptText(reviewPrompt) {
	const lines = [
		"Review required:",
		reviewPrompt.question,
	];
	if (reviewPrompt.options && reviewPrompt.options.length) {
		lines.push("");
		lines.push("Available answers:");
		for (const option of reviewPrompt.options) lines.push(`- ${option.label}`);
	}
	lines.push("");
	lines.push(reviewPrompt.message);
	lines.push(reviewPrompt.minimumInputRequired);
	lines.push("The browser will stay open while this prompt waits. Enter /stop to stop.");
	return lines.join("\n");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
