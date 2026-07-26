const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { launchPersistentChromiumContext } = require("./browser");
const { openPageInContext } = require("./page");

async function main() {
	const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "playwright-agent-chrome-"));
	const fixture = await createFixtureServer();

	try {
		await seedDedicatedChromeProfile(userDataDir, fixture.origin);
		await assertDedicatedChromeStateAndOwnedPage(userDataDir, fixture.origin);
	} finally {
		await fixture.close();
		await fs.rm(userDataDir, { force: true, recursive: true });
	}
}

async function seedDedicatedChromeProfile(userDataDir, origin) {
	const context = await launchDedicatedChrome(userDataDir);
	try {
		const page = await context.newPage();
		await page.goto(`${origin}/state`);
		await page.evaluate(() => {
			document.cookie = "apply-session=persisted; Max-Age=3600; SameSite=Lax";
			localStorage.setItem("apply-session", "persisted");
		});
		await assertNoUnsupportedSandboxFlag(page);
	} finally {
		await context.close();
	}
}

async function assertDedicatedChromeStateAndOwnedPage(userDataDir, origin) {
	const context = await launchDedicatedChrome(userDataDir);
	try {
		const existingPage = context.pages()[0] || await context.newPage();
		await existingPage.goto(`${origin}/existing`);

		const ownedPage = await openPageInContext(context, `${origin}/state`);

		assert.notEqual(ownedPage, existingPage);
		assert.equal(await existingPage.locator("#existing").textContent(), "existing page untouched");
		assert.match(await ownedPage.evaluate(() => document.cookie), /apply-session=persisted/);
		assert.equal(await ownedPage.evaluate(() => localStorage.getItem("apply-session")), "persisted");
	} finally {
		await context.close();
	}
}

function launchDedicatedChrome(userDataDir) {
	return launchPersistentChromiumContext({
		channel: "chrome",
		chromiumSandbox: true,
		headless: true,
		userDataDir,
	});
}

async function assertNoUnsupportedSandboxFlag(page) {
	await page.goto("chrome://version");
	const commandLine = await page.locator("#command_line").textContent();
	assert.doesNotMatch(commandLine || "", /(?:^|\s)--no-sandbox(?:\s|$)/);
}

async function createFixtureServer() {
	const server = http.createServer((request, response) => {
		response.setHeader("Content-Type", "text/html; charset=utf-8");
		if (request.url === "/existing") {
			response.end("<!doctype html><p id=\"existing\">existing page untouched</p>");
			return;
		}
		response.end("<!doctype html><title>state</title>");
	});

	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	return {
		origin: `http://127.0.0.1:${address.port}`,
		close: () => new Promise((resolve, reject) => {
			server.close((error) => error ? reject(error) : resolve());
		}),
	};
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
