const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const APPLY_CHROME_USER_DATA_DIR = path.resolve(".playwright", "apply-chrome-profile");
const GOOGLE_SIGN_IN_URL = "https://accounts.google.com/";

async function main() {
	const chromeExecutable = findInstalledChrome();
	await fs.promises.mkdir(APPLY_CHROME_USER_DATA_DIR, { recursive: true });

	console.log([
		"Opening the dedicated application Chrome profile without Playwright.",
		"Sign in manually, complete any MFA, then close the entire Chrome window.",
		"Do not run npm run apply until this window has closed.",
		`Profile: ${APPLY_CHROME_USER_DATA_DIR}`,
		"",
	].join("\n"));

	const exitCode = await launchChromeAndWait({
		chromeExecutable,
		userDataDir: APPLY_CHROME_USER_DATA_DIR,
		url: GOOGLE_SIGN_IN_URL,
	});
	if (exitCode !== 0) {
		throw new Error(`Chrome profile setup exited with code ${exitCode}.`);
	}

	console.log("Dedicated Chrome profile closed. You can now run npm run apply.");
}

function findInstalledChrome(options = {}) {
	const env = options.env || process.env;
	const existsSync = options.existsSync || fs.existsSync;
	const candidates = buildChromeExecutableCandidates(env);
	const executable = candidates.find((candidate) => existsSync(candidate));
	if (!executable) {
		throw new Error("Google Chrome was not found in the standard Windows installation locations.");
	}
	return executable;
}

function buildChromeExecutableCandidates(env = process.env) {
	return [
		env.PROGRAMFILES,
		env["PROGRAMFILES(X86)"],
		env.LOCALAPPDATA,
	]
		.filter(Boolean)
		.map((baseDir) => path.join(baseDir, "Google", "Chrome", "Application", "chrome.exe"));
}

function launchChromeAndWait({ chromeExecutable, userDataDir, url }) {
	return new Promise((resolve, reject) => {
		const child = spawn(chromeExecutable, [
			`--user-data-dir=${userDataDir}`,
			"--new-window",
			url,
		], {
			stdio: "ignore",
			windowsHide: false,
		});
		child.once("error", reject);
		child.once("exit", (code) => resolve(code ?? 1));
	});
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}

module.exports = {
	buildChromeExecutableCandidates,
	findInstalledChrome,
};
