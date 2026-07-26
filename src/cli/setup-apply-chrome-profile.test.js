const assert = require("node:assert/strict");
const path = require("node:path");

const {
	buildChromeExecutableCandidates,
	findInstalledChrome,
} = require("./setup-apply-chrome-profile");

function main() {
	const env = {
		PROGRAMFILES: "C:\\Program Files",
		"PROGRAMFILES(X86)": "C:\\Program Files (x86)",
		LOCALAPPDATA: "C:\\Users\\Aroha\\AppData\\Local",
	};
	const candidates = buildChromeExecutableCandidates(env);

	assert.deepEqual(candidates, [
		path.join(env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
		path.join(env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
		path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
	]);
	assert.equal(findInstalledChrome({
		env,
		existsSync: (candidate) => candidate === candidates[2],
	}), candidates[2]);
	assert.throws(() => findInstalledChrome({
		env,
		existsSync: () => false,
	}), /Google Chrome was not found/);
}

main();
