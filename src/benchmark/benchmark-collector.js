const path = require("node:path");

const { observePage } = require("../agent/observer");
const { attachPageDiagnostics } = require("../browser/diagnostics");
const { launchChromium } = require("../browser/browser");
const { waitForPageStable } = require("../browser/stability");
const { createRunLogDir, writeJsonArtifact, writeTextArtifact } = require("../logging/artifact-store");
const { captureAccessibilityTree } = require("../parsers/accessibility");
const { captureHtml } = require("../parsers/dom");
const { captureScreenshot } = require("../parsers/screenshot");
const { reasonAboutPage } = require("../reasoning/adaptive-reasoning");
const { StateManager } = require("../state/state-manager");
const { buildObservationReport } = require("./observation-report");

async function collectObservationBenchmark(url, options = {}) {
	const { runId, runDir } = await createRunLogDir(options.logsDir || "logs/observations");
	const browser = await launchChromium({ headless: options.headless });

	try {
		const context = await browser.newContext({
			viewport: options.viewport || { width: 1365, height: 900 },
		});
		const page = await context.newPage();
		const diagnostics = attachPageDiagnostics(page);
		page.setDefaultNavigationTimeout(options.navigationTimeoutMs || 45000);
		page.setDefaultTimeout(options.navigationTimeoutMs || 45000);

		try {
			await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: options.navigationTimeoutMs || 45000,
			});
			const stability = await waitForPageStable(page, options.stability);
			const observation = await observePage(page);
			const stateManager = new StateManager("Observe job application website for benchmark collection.");
			stateManager.setExecutionStatus("observing");
			const runtimeState = stateManager.applyObservation(observation);
			stateManager.setExecutionStatus("observation-completed");
			const finalRuntimeState = stateManager.getState();
			const reasoning = reasonAboutPage(observation.semanticPage, runtimeState);
			const reasoningLog = [toReasoningLogEntry(reasoning)];
			const html = await captureHtml(page);
			const accessibilityTree = await captureAccessibilityTree(page);
			const screenshotPath = path.join(runDir, "screenshot.png");
			await captureScreenshot(page, screenshotPath);
			const collectedDiagnostics = diagnostics.getDiagnostics();

			const artifacts = {
				domSnapshot: "dom-snapshot.html",
				semanticPage: "semantic-page.json",
				accessibilitySnapshot: "accessibility-snapshot.json",
				screenshot: "screenshot.png",
				runtimeState: "runtime-state.json",
				reasoningLog: "reasoning-log.json",
				consoleErrors: "console-errors.json",
				networkErrors: "network-errors.json",
				observationReport: "observation-report.json",
			};

			const report = buildObservationReport({
				runId,
				requestedUrl: url,
				finalUrl: page.url(),
				title: await page.title(),
				stability,
				runtimeState: finalRuntimeState,
				reasoningLog,
				diagnostics: collectedDiagnostics,
				artifacts,
			});

			await writeTextArtifact(runDir, artifacts.domSnapshot, html);
			await writeJsonArtifact(runDir, artifacts.semanticPage, observation.semanticPage);
			await writeJsonArtifact(runDir, artifacts.accessibilitySnapshot, accessibilityTree);
			await writeJsonArtifact(runDir, artifacts.runtimeState, finalRuntimeState);
			await writeJsonArtifact(runDir, artifacts.reasoningLog, reasoningLog);
			await writeJsonArtifact(runDir, artifacts.consoleErrors, collectedDiagnostics.consoleErrors);
			await writeJsonArtifact(runDir, artifacts.networkErrors, collectedDiagnostics.networkErrors);
			await writeJsonArtifact(runDir, artifacts.observationReport, report);

			return {
				runDir,
				report,
			};
		} finally {
			await context.close();
		}
	} finally {
		await browser.close();
	}
}

function toReasoningLogEntry(reasoning) {
	return {
		observedAt: new Date().toISOString(),
		pageIntent: reasoning.pageIntent,
		nextObjective: reasoning.nextObjective,
		note: "Reasoning log is advisory only; no browser action was executed.",
	};
}

module.exports = {
	collectObservationBenchmark,
};
