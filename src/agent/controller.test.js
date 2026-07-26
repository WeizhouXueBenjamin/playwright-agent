const assert = require("node:assert/strict");

const { AgentController } = require("./controller");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");

async function main() {
	const browser = await launchChromium();

	try {
		await assertAsyncComboboxWaitsForStableOptions(browser);
		await assertMultiStepLoop(browser);
		await assertRecoveryRetriesFailedClick(browser);
		await assertAdaptsThroughCookieBanner(browser);
		await assertStopsOnLoginPage(browser);
		await assertManualLoginPauseResumesAndReobserves(browser);
		await assertManualLoginStopsAfterTwoResumeAttempts(browser);
		await assertManualLoginBrowserCloseStopsSafely(browser);
		await assertStopsOnUnavailableApplication(browser);
		await assertAdvancesUnexpectedIntermediatePage(browser);
		await assertStopsBeforeFinalSubmission(browser);
		await assertFinalReviewProviderHoldsBrowserOwnedRun();
		await assertFinalReviewStopPreservesBoundaryStatus();
		await assertFinalReviewProviderDoesNotRunForFieldCheckpoint();
		await assertReviewHoldKeepsRunPending(browser);
		await assertNonInteractiveCheckpointAfterSafeFields(browser);
		await assertGateReviewUsesReviewProvider(browser);
		await assertCheckpointSummaryQuitStopsWithoutSkipping(browser);
		await assertMissingCheckpointDecisionIsRejected(browser);
		await assertUnavailableOptionIsRejected(browser);
		await assertMissingFileIsRejected(browser);
		await assertCustomConsentSelectionResumesOnce(browser);
		await assertCustomCountrySelectsUniqueCompatibleOption(browser);
		await assertCustomWorkEligibilitySelectsControlledEquivalentOption(browser);
		await assertUnresolvedRequiredOptionCreatesCheckpoint(browser);
		await assertSearchableCitySelectsUniqueCompatibleOption(browser);
		await assertSearchableCityResumesWithReviewedOption(browser);
		await assertSearchableSchoolMatchesLeadingArticle(browser);
		await assertUnsupportedOptionalSelectionIsSkipped(browser);
		await assertResumesAfterReviewAnswer(browser);
		await assertSupportsReviewSkip(browser);
		await assertSupportsReviewManual(browser);
		await assertManualFailureReturnsToReview(browser);
		await assertSupportsReviewStop(browser);
	} finally {
		await browser.close();
	}
}

async function assertNonInteractiveCheckpointAfterSafeFields(browser) {
	const { context, page } = await openPage(browser, createCheckpointReviewPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
		});

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "review-checkpoint-pending");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
		assert.equal(result.runtimeState.pendingReviewCheckpoint.items.length, 2);
		assert.equal(result.runtimeState.pendingReviewCheckpoint.items[0].type, "consent-authorization");
		assert.equal(result.runtimeState.pendingReviewCheckpoint.items[1].type, "manual-value-required");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertGateReviewUsesReviewProvider(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);
		let reviewCalls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			gateStep: async ({ step }) => ({
				type: "review-item",
				reason: "gate-review-required",
				step,
				field: step.field,
				safetyDecision: {
					fieldIntent: "privacy-consent",
					reason: "legal-consent-requires-user-review",
				},
			}),
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				reviewCalls += 1;
				return [{ itemId: reviewCheckpoint.items[0].id, action: "stop" }];
			},
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(reviewCalls, 1);
		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(result.reviewCheckpoint.items[0].fieldIntent, "privacy-consent");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertManualFailureReturnsToReview(browser) {
	const { context, page } = await openPage(browser, createManualReviewPageUrl());
	try {
		await waitForPageStable(page);
		let reviewCalls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			gateStep: async ({ step }) => ({
				type: "review-item",
				reason: "gate-review-required",
				step,
				field: step.field,
				safetyDecision: {
					fieldIntent: "first-name",
					reason: "manual-verification-regression",
				},
			}),
			reviewCheckpointProvider: async ({ page: activePage, reviewCheckpoint }) => {
				reviewCalls += 1;
				if (reviewCalls === 2) await activePage.getByLabel("First name").fill("Aroha");
				return [{ itemId: reviewCheckpoint.items[0].id, action: "manual" }];
			},
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(reviewCalls, 2);
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.lifecycle.some((entry) => entry.phase === "observe-think-review-checkpoint-unresolved"), true);
		assert.equal(result.runtimeState.completedFields.some((field) => field.resolutionMethod === "manual"), true);
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertCheckpointSummaryQuitStopsWithoutSkipping(browser) {
	const { context, page } = await openPage(browser, createCheckpointReviewPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async () => [{ itemId: "__checkpoint", action: "stop" }],
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(result.runtimeState.skippedFields.length, 0);
		assert.equal(result.runtimeState.reviewAnswers.length, 0);
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertMissingCheckpointDecisionIsRejected(browser) {
	const { context, page } = await openPage(browser, createCheckpointReviewPageUrl());
	try {
		await waitForPageStable(page);
		let calls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				calls += 1;
				if (calls === 1) return [{ itemId: reviewCheckpoint.items[0].id, action: "authorize" }];
				return [{ itemId: "__checkpoint", action: "stop" }];
			},
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(calls, 2);
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(result.runtimeState.skippedFields.length, 0);
		assert.equal(result.runtimeState.reviewAnswers.length, 0);
		assert.equal(result.lifecycle.some((entry) => entry.reviewCheckpoint
			&& entry.reviewCheckpoint.reason === "review-decision-missing"), true);
	} finally {
		await context.close();
	}
}

async function assertUnavailableOptionIsRejected(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);
		let calls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				calls += 1;
				if (calls === 1) return [{ itemId: reviewCheckpoint.items[0].id, action: "select", value: "Maybe" }];
				return [{ itemId: "__checkpoint", action: "stop" }];
			},
		});
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
			workAuthorization: "Open work visa valid until 2027",
		});

		assert.equal(calls, 2);
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(result.runtimeState.reviewAnswers.length, 0);
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "");
	} finally {
		await context.close();
	}
}

async function assertMissingFileIsRejected(browser) {
	const { context, page } = await openPage(browser, createFileReviewPageUrl());
	try {
		await waitForPageStable(page);
		let calls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				calls += 1;
				if (calls === 1) {
					return [{ itemId: reviewCheckpoint.items[0].id, action: "provide-file", value: "missing-resume.pdf" }];
				}
				return [{ itemId: "__checkpoint", action: "stop" }];
			},
		});
		const result = await controller.runOnPage(page, {});

		assert.equal(calls, 2);
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(result.runtimeState.reviewAnswers.length, 0);
		assert.equal(result.lifecycle.some((entry) => entry.reviewCheckpoint
			&& entry.reviewCheckpoint.reason === "review-decision-file-not-found"), true);
	} finally {
		await context.close();
	}
}

async function assertCustomConsentSelectionResumesOnce(browser) {
	const { context, page } = await openPage(browser, createCustomConsentPageUrl());
	try {
		await waitForPageStable(page);
		let calls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				calls += 1;
				const item = reviewCheckpoint.items[0];
				assert.equal(item.type, "consent-authorization");
				assert.deepEqual(item.options.map((option) => option.label), ["Acknowledge/Confirm"]);
				return [{ itemId: item.id, action: "authorize", value: "Acknowledge/Confirm" }];
			},
		});
		const result = await controller.runOnPage(page, {});

		assert.equal(calls, 1);
		assert.equal(["awaiting-human-confirmation", "needs-review"].includes(result.status), true, result.status);
		assert.equal(await page.locator("#selected-value").textContent(), "Acknowledge/Confirm");
		assert.equal(result.runtimeState.completedFields.some((field) => field.resolutionMethod === "user-confirmed"), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertCustomCountrySelectsUniqueCompatibleOption(browser) {
	const { context, page } = await openPage(browser, createCustomCountryPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { country: "New Zealand" });

		assert.ok(["awaiting-human-confirmation", "needs-review", "completed"].includes(result.status), result.status);
		assert.equal(await page.locator("#selected-country").textContent(), "+64");
		assert.equal(result.runtimeState.completedFields.some((field) => field.verifiedValue === "+64"), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(await page.locator("#country-submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertCustomWorkEligibilitySelectsControlledEquivalentOption(browser) {
	const { context, page } = await openPage(browser, createCustomWorkEligibilityPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { workAuthorization: "New Zealand Permanent Resident visa" });

		assert.equal(["awaiting-human-confirmation", "needs-review"].includes(result.status), true);
		assert.equal(await page.locator("#selected-work").textContent(), "Citizen or Permanent Resident");
		assert.equal(result.runtimeState.completedFields.some((field) => field.verifiedValue === "Citizen or Permanent Resident"), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(await page.locator("#work-submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertAsyncComboboxWaitsForStableOptions(browser) {
	const { context, page } = await openPage(browser, createUnstableCountryComboboxPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { country: "New Zealand" });

		assert.ok(["awaiting-human-confirmation", "needs-review", "completed"].includes(result.status), result.status);
		assert.equal(await page.locator("#selected-country").textContent(), "+64");
		assert.equal(await page.locator("#option-state").textContent(), "stable");
		assert.equal(result.lifecycle.some((entry) => entry.actionResult && entry.actionResult.verification.actual === "+64"), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertUnresolvedRequiredOptionCreatesCheckpoint(browser) {
	const { context, page } = await openPage(browser, createUnresolvedWorkEligibilityComboboxPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { workAuthorization: "New Zealand Permanent Resident visa" });

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "review-checkpoint-pending");
		assert.equal(await page.locator("#selected-work").textContent(), "Select...");
		assert.equal(result.runtimeState.pendingReviewCheckpoint.items.length, 1);
		const item = result.runtimeState.pendingReviewCheckpoint.items[0];
		assert.equal(item.type, "option-selection");
		assert.equal(item.fieldLabel.text, "Work Eligibility*");
		assert.deepEqual(item.options.map((option) => option.label), ["Citizen", "Work Visa"]);
		assert.equal(item.optionMatch.reason, "missing-permanent-resident");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(await page.locator("#work-submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertSearchableCitySelectsUniqueCompatibleOption(browser) {
	const { context, page } = await openPage(browser, createSearchableCityPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { city: "Auckland", country: "New Zealand" });

		assert.equal(["awaiting-human-confirmation", "needs-review"].includes(result.status), true);
		assert.equal(await page.locator("#selected-city").textContent(), "Auckland, Auckland Region, New Zealand");
		assert.equal(result.runtimeState.completedFields.some((field) => field.verifiedValue === "Auckland, Auckland Region, New Zealand"), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertSearchableCityResumesWithReviewedOption(browser) {
	const { context, page } = await openPage(browser, createAmbiguousSearchableCityPageUrl());
	try {
		await waitForPageStable(page);
		let reviewCalls = 0;
		const selectedLabel = "Auckland, Auckland Region, New Zealand";
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				reviewCalls += 1;
				const item = reviewCheckpoint.items[0];
				assert.equal(item.fieldLabel.text, "Location (City)*");
				assert.equal(item.type, "option-selection");
				assert.equal(item.options.length, 3);
				return [{ itemId: item.id, action: "select", value: selectedLabel }];
			},
		});
		const result = await controller.runOnPage(page, { city: "Auckland", country: "New Zealand" });

		assert.equal(reviewCalls, 1);
		assert.equal(await page.locator("#selected-city").textContent(), selectedLabel);
		assert.equal(result.runtimeState.completedFields.some((field) => (
			field.source === "explicit-user-review" && field.verifiedValue === selectedLabel
		)), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertSearchableSchoolMatchesLeadingArticle(browser) {
	const { context, page } = await openPage(browser, createSearchableSchoolPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { education: { school: "University of Auckland" } });

		assert.equal(["awaiting-human-confirmation", "needs-review"].includes(result.status), true);
		assert.equal(await page.locator("#selected-school").textContent(), "The University of Auckland");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertUnsupportedOptionalSelectionIsSkipped(browser) {
	const { context, page } = await openPage(browser, createUnsupportedOptionalSelectionPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { education: { degree: "Bachelor of Science" } });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.skippedFields.some((field) => field.label.text === "Degree"), true);
		assert.equal(result.lifecycle.some((entry) => entry.recovery && entry.recovery.strategy === "skip-unsupported-optional-selection"), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertReviewHoldKeepsRunPending(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		let resolveReview;
		const reviewStarted = [];
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint, runtimeState }) => {
				reviewStarted.push(runtimeState.currentExecutionStatus);
				return new Promise((resolve) => {
					resolveReview = () => resolve(reviewCheckpoint.items.map((item) => ({
						itemId: item.id,
						action: "select",
						value: "Yes",
					})));
				});
			},
		});
		const runPromise = controller.runOnPage(page, {
			firstName: "Aroha",
			workAuthorization: "Open work visa valid until 2027",
		}).catch((error) => ({ __controllerError: error }));

		await waitFor(() => reviewStarted.length > 0, 2000);
		assert.deepEqual(reviewStarted, ["review-pending"]);
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(typeof resolveReview, "function");

		resolveReview({ answer: "Yes" });
		let result;
		result = await runPromise;
		if (result && result.__controllerError) throw result.__controllerError;
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "Yes");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function waitFor(predicate, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for condition.");
}

async function assertStopsOnUnavailableApplication(browser) {
	const { context, page } = await openPage(browser, createUnavailablePageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 5 });
		const result = await controller.runOnPage(page, {});

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "application-unavailable");
		assert.equal(result.lifecycle[0].terminalState.details.pageIntent.intent, "application-unavailable");
	} finally {
		await context.close();
	}
}

function createUnavailablePageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<main>",
		"<h1>This job is no longer available</h1>",
		"<p>We are no longer accepting applications for this role.</p>",
		"</main>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

async function assertSupportsReviewStop(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => reviewCheckpoint.items.map((item) => ({
				itemId: item.id,
				action: "stop",
			})),
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertResumesAfterReviewAnswer(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const checkpoints = [];
		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				checkpoints.push(reviewCheckpoint);
				return reviewCheckpoint.items.map((item) => ({
					itemId: item.id,
					action: "select",
					value: "Yes",
				}));
			},
		});
		const profile = {
			firstName: "Aroha",
			workAuthorization: "Open work visa valid until 2027",
		};
		const originalProfile = structuredClone(profile);
		const result = await controller.runOnPage(page, profile);

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(checkpoints.length, 1);
		assert.equal(checkpoints[0].items[0].fieldLabel.text, "Are you legally authorized to work in New Zealand?");
		assert.deepEqual(checkpoints[0].items[0].options, [{ label: "Yes" }, { label: "No" }]);
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "Yes");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(result.runtimeState.reviewAnswers.length, 1);
		assert.equal(result.runtimeState.reviewAnswers[0].source, "explicit-user-review");
		assert.equal(result.runtimeState.reviewAnswers[0].scope, "current-run");
		assert.equal(result.runtimeState.completedFields.some((field) => field.source === "explicit-user-review"), true);
		assert.equal(result.runtimeState.manualReview.length, 1);
		assert.deepEqual(profile, originalProfile);
	} finally {
		await context.close();
	}
}

async function assertSupportsReviewSkip(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 10,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => reviewCheckpoint.items.map((item) => ({
				itemId: item.id,
				action: "skip",
			})),
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.skippedFields.length, 1);
		assert.equal(result.runtimeState.skippedFields[0].resolutionMethod, "skipped");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertSupportsReviewManual(browser) {
	const { context, page } = await openPage(browser, createManualReviewPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 10,
			gateStep: async ({ step }) => ({
				type: "review-item",
				reason: "gate-review-required",
				step,
				field: step.field,
				safetyDecision: {
					fieldIntent: "first-name",
					reason: "manual-completion-regression",
				},
			}),
			reviewCheckpointProvider: async ({ page: activePage, reviewCheckpoint }) => {
				await activePage.getByLabel("First name").fill("Aroha");
				return [{ itemId: reviewCheckpoint.items[0].id, action: "manual" }];
			},
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.completedFields.some((field) => field.resolutionMethod === "manual"), true);
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertMultiStepLoop(browser) {
	const { context, page } = await openPage(browser, createMultiStepPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
			country: "New Zealand",
		});

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.getByLabel("Country").inputValue(), "New Zealand");
		assert.equal(result.runtimeState.currentExecutionStatus, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.completedFields.length, 2);
		assert.equal(result.runtimeState.recentActions.length, 3);
		assert.equal(result.runtimeState.detectedFields.some((field) => field.label.text === "Country"), true);
		assert.equal(JSON.stringify(result.runtimeState).includes("confidence"), false);
		assert.equal(JSON.stringify(result.runtimeState).includes("reasoning"), false);

		const actions = result.lifecycle
			.filter((entry) => entry.actionResult)
			.map((entry) => entry.actionResult.step.action);
		assert.deepEqual(actions, ["fill-text", "click", "select-option"]);
	} finally {
		await context.close();
	}
}

async function assertAdaptsThroughCookieBanner(browser) {
	const { context, page } = await openPage(browser, createCookieBannerPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(result.lifecycle.some((entry) => entry.decision.reasoning === "Handle cookie-banner."), true);
	} finally {
		await context.close();
	}
}

async function assertStopsOnLoginPage(browser) {
	const { context, page } = await openPage(browser, createLoginPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 5 });
		const result = await controller.runOnPage(page, {});

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "login-required");
		assert.equal(result.lifecycle[0].terminalState.details.pageIntent.intent, "login-page");
	} finally {
		await context.close();
	}
}

async function assertAdvancesUnexpectedIntermediatePage(browser) {
	const { context, page } = await openPage(browser, createIntermediatePageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(result.lifecycle.some((entry) => entry.decision.reasoning === "Handle unexpected-intermediate-page."), true);
	} finally {
		await context.close();
	}
}

async function assertRecoveryRetriesFailedClick(browser) {
	const { context, page } = await openPage(browser, createRetryClickPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
			country: "New Zealand",
		});

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("Country").inputValue(), "New Zealand");
		assert.equal(result.lifecycle.some((entry) => entry.recovery && entry.recovery.strategy === "retry-once"), true);
		assert.equal(result.runtimeState.recentActions.some((action) => action.action === "click"), true);
	} finally {
		await context.close();
	}
}

async function assertStopsBeforeFinalSubmission(browser) {
	const { context, page } = await openPage(browser, createFinalSubmitPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 5 });
		const result = await controller.runOnPage(page, {});

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertManualLoginPauseResumesAndReobserves(browser) {
	const { context, page } = await openPage(browser, createRecoverableLoginPageUrl());
	try {
		await waitForPageStable(page);
		let resumeLogin;
		const controller = new AgentController({
			maxCycles: 8,
			manualLoginProvider: async () => new Promise((resolve) => {
				resumeLogin = () => resolve({ action: "resume" });
			}),
		});
		const runPromise = controller.runOnPage(page, { firstName: "Aroha" });

		await waitFor(() => typeof resumeLogin === "function", 2000);
		let settled = false;
		runPromise.then(() => { settled = true; });
		await Promise.resolve();
		assert.equal(settled, false);
		await page.evaluate(() => {
			document.querySelector("#login").remove();
			document.querySelector("#application").hidden = false;
		});
		resumeLogin();

		const result = await runPromise;
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.deepEqual(result.lifecycle.find((entry) => entry.manualIntervention).manualIntervention, {
			type: "manual-login",
			outcome: "resumed",
			attempts: 1,
		});
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertManualLoginStopsAfterTwoResumeAttempts(browser) {
	const { context, page } = await openPage(browser, createLoginPageUrl());
	try {
		await waitForPageStable(page);
		let calls = 0;
		const controller = new AgentController({
			maxCycles: 8,
			manualLoginProvider: async () => {
				calls += 1;
				return { action: "resume" };
			},
		});
		const result = await controller.runOnPage(page, {});

		assert.equal(calls, 2);
		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "login-required");
		assert.deepEqual(result.lifecycle.at(-1).manualIntervention, {
			type: "manual-login",
			outcome: "stopped",
			attempts: 2,
		});
	} finally {
		await context.close();
	}
}

async function assertManualLoginBrowserCloseStopsSafely(browser) {
	const { context, page } = await openPage(browser, createLoginPageUrl());
	try {
		await waitForPageStable(page);
		let providerStarted = false;
		const controller = new AgentController({
			maxCycles: 5,
			manualLoginProvider: async ({ signal }) => new Promise((resolve) => {
				providerStarted = true;
				signal.addEventListener("abort", () => resolve({ action: "stop" }), { once: true });
			}),
		});
		const runPromise = controller.runOnPage(page, {});

		await waitFor(() => providerStarted, 2000);
		await page.close();
		const result = await runPromise;
		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "login-required");
		assert.equal(result.lifecycle.at(-1).manualIntervention.outcome, "stopped");
	} finally {
		await context.close();
	}
}

async function assertFinalReviewProviderHoldsBrowserOwnedRun() {
	let resolveFinalReview;
	let providerSummary;
	let providerSignal;
	const controller = new AgentController({
		maxCycles: 5,
		finalReviewProvider: async ({ summary, signal }) => {
			providerSummary = summary;
			providerSignal = signal;
			return new Promise((resolve) => {
				resolveFinalReview = () => resolve({ action: "finish-without-submit" });
			});
		},
	});
	const runPromise = controller.run(createFinalSubmitPageUrl(), {}).catch((error) => ({ __controllerError: error }));

	await waitFor(() => typeof resolveFinalReview === "function", 2000);
	assert.equal(providerSummary.status, "ready-for-review");
	assert.equal(providerSummary.reason, "final-submission-control-detected");
	assert.equal(providerSummary.finalSubmissionTriggered, false);
	assert.equal(providerSignal.aborted, false);

	let settled = false;
	runPromise.then(() => { settled = true; });
	await Promise.resolve();
	assert.equal(settled, false);

	resolveFinalReview();
	const result = await runPromise;
	if (result && result.__controllerError) throw result.__controllerError;
	assert.equal(result.status, "awaiting-human-confirmation");
	assert.equal(result.reason, "final-submission-control-detected");
	assert.deepEqual(result.finalReview, {
		interactive: true,
		state: "finished-without-submit",
		automatedActionsPerformed: false,
		manualSubmissionOutcome: "unknown",
	});
	assert.equal(result.runtimeState.finalSubmissionTriggered, false);
}

async function assertFinalReviewStopPreservesBoundaryStatus() {
	const controller = new AgentController({
		maxCycles: 5,
		finalReviewProvider: async () => ({ action: "stop" }),
	});

	const result = await controller.run(createFinalSubmitPageUrl(), {});

	assert.equal(result.status, "awaiting-human-confirmation");
	assert.equal(result.reason, "final-submission-control-detected");
	assert.deepEqual(result.finalReview, {
		interactive: true,
		state: "stopped-by-user",
		automatedActionsPerformed: false,
		manualSubmissionOutcome: "unknown",
	});
	assert.equal(result.runtimeState.finalSubmissionTriggered, false);
}

async function assertFinalReviewProviderDoesNotRunForFieldCheckpoint() {
	let calls = 0;
	const controller = new AgentController({
		maxCycles: 5,
		finalReviewProvider: async () => {
			calls += 1;
			return { action: "finish-without-submit" };
		},
	});

	const result = await controller.run(createCheckpointReviewPageUrl(), { firstName: "Aroha" });

	assert.equal(result.status, "needs-review");
	assert.equal(result.reason, "review-checkpoint-pending");
	assert.equal(calls, 0);
	assert.equal(result.finalReview, undefined);
	assert.equal(result.runtimeState.finalSubmissionTriggered, false);
}

function createCookieBannerPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<div id=\"cookie\">We use cookies for privacy. <button type=\"button\">Accept cookies</button></div>",
		"<form>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<script>",
		"document.querySelector('#cookie button').addEventListener('click', () => document.querySelector('#cookie').remove());",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createLoginPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label for=\"email\">Email</label>",
		"<input id=\"email\" type=\"email\">",
		"<label for=\"password\">Password</label>",
		"<input id=\"password\" type=\"password\">",
		"<button type=\"submit\">Sign in</button>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createIntermediatePageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<section id=\"intro\">",
		"<p>Please review this intermediate page.</p>",
		"<button type=\"button\">Continue</button>",
		"</section>",
		"<form hidden>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<script>",
		"document.querySelector('#intro button').addEventListener('click', () => {",
		"document.querySelector('#intro').hidden = true;",
		"document.querySelector('form').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createRetryClickPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<section id=\"step-1\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"button\" id=\"continue\">Continue</button>",
		"</section>",
		"<section id=\"step-2\" hidden>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\">",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"<button type=\"submit\">Submit application</button>",
		"</section>",
		"</form>",
		"<script>",
		"let clicks = 0;",
		"document.querySelector('#continue').addEventListener('click', () => {",
		"clicks += 1;",
		"if (clicks < 2) return;",
		"document.querySelector('#step-1').hidden = true;",
		"document.querySelector('#step-2').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createMultiStepPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<section id=\"step-1\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"button\" id=\"continue\">Continue</button>",
		"</section>",
		"<section id=\"step-2\" hidden>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\">",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"<button type=\"submit\">Submit application</button>",
		"</section>",
		"</form>",
		"<script>",
		"document.querySelector('#continue').addEventListener('click', () => {",
		"document.querySelector('#step-1').hidden = true;",
		"document.querySelector('#step-2').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createFinalSubmitPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"submitted\">not submitted</div>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createRecoverableLoginPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form id=\"login\">",
		"<label for=\"email\">Email</label>",
		"<input id=\"email\" type=\"email\">",
		"<label for=\"password\">Password</label>",
		"<input id=\"password\" type=\"password\">",
		"<button type=\"submit\">Sign in</button>",
		"</form>",
		"<form id=\"application\" hidden>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createCheckpointReviewPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<label for=\"privacy\">Recruitment Privacy Policy</label>",
		"<input id=\"privacy\" name=\"privacy\" type=\"checkbox\" required>",
		"<label for=\"salary\">Expected salary</label>",
		"<input id=\"salary\" name=\"salary\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"submitted\">not submitted</div>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createManualReviewPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"submitted\">not submitted</div>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createFileReviewPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"return false;\">",
		"<label for=\"resume\">Resume</label>",
		"<input id=\"resume\" name=\"resume\" type=\"file\" required>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createCustomConsentPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<label id=\"privacy-label\" for=\"privacy\">Recruitment Privacy Policy*</label>",
		"<div id=\"privacy-control\"><div id=\"selected-value\">Select...</div><div>",
		"<input id=\"privacy\" type=\"text\" role=\"combobox\" aria-labelledby=\"privacy-label\" aria-required=\"true\" aria-controls=\"privacy-listbox\" aria-expanded=\"false\">",
		"</div></div>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"submitted\">not submitted</div>",
		"<script>",
		"const input = document.querySelector('#privacy');",
		"function closeListbox() { document.querySelector('#privacy-listbox')?.remove(); input.setAttribute('aria-expanded', 'false'); }",
		"function openListbox() {",
		"  closeListbox(); input.setAttribute('aria-expanded', 'true');",
		"  const listbox = document.createElement('div'); listbox.id = 'privacy-listbox'; listbox.setAttribute('role', 'listbox');",
		"  const option = document.createElement('div'); option.setAttribute('role', 'option'); option.id = 'privacy-option'; option.textContent = 'Acknowledge/Confirm';",
		"  option.addEventListener('click', () => { document.querySelector('#selected-value').textContent = option.textContent; closeListbox(); });",
		"  listbox.appendChild(option); document.body.appendChild(listbox);",
		"}",
		"input.addEventListener('click', openListbox);",
		"input.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeListbox(); });",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createCustomCountryPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#country-submitted').textContent = 'submitted'; return false;\">",
		"<label id=\"country-label\" for=\"country\">Country*</label>",
		"<div id=\"country-control\"><div id=\"selected-country\">Select...</div><div>",
		"<input id=\"country\" type=\"text\" role=\"combobox\" aria-labelledby=\"country-label\" aria-required=\"true\" aria-controls=\"country-listbox\" aria-expanded=\"false\">",
		"</div></div>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"country-submitted\">not submitted</div>",
		"<div id=\"option-state\"></div>",
		"<script>",
		"const countryInput = document.querySelector('#country');",
		"let countryOptionsScheduled = false;",
		"function closeCountryListbox() { document.querySelector('#country-listbox')?.remove(); countryInput.setAttribute('aria-expanded', 'false'); }",
		"function openCountryListbox() {",
		"  closeCountryListbox(); countryInput.setAttribute('aria-expanded', 'true');",
		"  const listbox = document.createElement('div'); listbox.id = 'country-listbox'; listbox.setAttribute('role', 'listbox');",
		"  for (const label of ['New Caledonia +687', 'New Zealand +64']) {",
		"    const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"    option.addEventListener('click', () => { document.querySelector('#selected-country').textContent = label.split(' ').at(-1); closeCountryListbox(); });",
		"    listbox.appendChild(option);",
		"  }",
		"  document.body.appendChild(listbox);",
		"}",
		"countryInput.addEventListener('click', openCountryListbox);",
		"countryInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCountryListbox(); });",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createCustomWorkEligibilityPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#work-submitted').textContent = 'submitted'; return false;\">",
		"<label id=\"work-label\" for=\"work\">Work Eligibility*</label>",
		"<div id=\"work-control\"><div id=\"selected-work\">Select...</div><div>",
		"<input id=\"work\" type=\"text\" role=\"combobox\" aria-labelledby=\"work-label\" aria-required=\"true\" aria-controls=\"work-listbox\" aria-expanded=\"false\">",
		"</div></div>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"work-submitted\">not submitted</div>",
		"<script>",
		"const input = document.querySelector('#work');",
		"function closeWorkListbox() { const existing = document.querySelector('#work-listbox'); if (existing) existing.remove(); input.setAttribute('aria-expanded', 'false'); }",
		"function renderWorkOptions() {",
		"  closeWorkListbox();",
		"  const listbox = document.createElement('div'); listbox.id = 'work-listbox'; listbox.setAttribute('role', 'listbox');",
		"  for (const label of ['Citizen or Permanent Resident', 'Work Visa', 'Not currently eligible to work']) {",
		"    const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"    option.addEventListener('click', () => { document.querySelector('#selected-work').textContent = label; input.value = ''; closeWorkListbox(); });",
		"    listbox.appendChild(option);",
		"  }",
		"  document.body.appendChild(listbox); input.setAttribute('aria-expanded', 'true');",
		"}",
		"input.addEventListener('click', renderWorkOptions);",
		"input.addEventListener('input', () => setTimeout(renderWorkOptions, 20));",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createUnstableCountryComboboxPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#country-submitted').textContent = 'submitted'; return false;\">",
		"<label id=\"country-label\" for=\"country\">Country*</label>",
		"<div id=\"country-control\"><div id=\"selected-country\">Select...</div><div>",
		"<input id=\"country\" type=\"text\" role=\"combobox\" aria-labelledby=\"country-label\" aria-required=\"true\" aria-controls=\"country-listbox\" aria-expanded=\"false\">",
		"</div></div>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"country-submitted\">not submitted</div>",
		"<div id=\"option-state\"></div>",
		"<script>",
		"const countryInput = document.querySelector('#country');",
		"let countryOptionsScheduled = false;",
		"function closeCountryListbox() { document.querySelector('#country-listbox')?.remove(); countryInput.setAttribute('aria-expanded', 'false'); }",
		"function appendCountryOption(listbox, label) {",
		"  const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"  option.addEventListener('click', () => {",
		"    const state = listbox.children.length > 1 ? 'stable' : 'early';",
		"    document.querySelector('#option-state').textContent = state;",
		"    document.querySelector('#selected-country').textContent = label.endsWith('+64') ? '+64' : label;",
		"    countryInput.value = ''; closeCountryListbox();",
		"  });",
		"  listbox.appendChild(option);",
		"}",
		"function renderCountryOptions() {",
		"  if (countryInput.value !== 'New Zealand') return;",
		"  let listbox = document.querySelector('#country-listbox');",
		"  if (listbox) return;",
		"  listbox = document.createElement('div'); listbox.id = 'country-listbox'; listbox.setAttribute('role', 'listbox');",
		"  document.body.appendChild(listbox); countryInput.setAttribute('aria-expanded', 'true');",
		"  appendCountryOption(listbox, 'New Zealand +64');",
		"  if (!countryOptionsScheduled) { countryOptionsScheduled = true; setTimeout(() => appendCountryOption(listbox, 'New Zealand citizen'), 120); }",
		"}",
		"countryInput.addEventListener('click', renderCountryOptions);",
		"countryInput.addEventListener('input', renderCountryOptions);",
		"countryInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCountryListbox(); });",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createUnresolvedWorkEligibilityComboboxPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#work-submitted').textContent = 'submitted'; return false;\">",
		"<label id=\"work-label\" for=\"work\">Work Eligibility*</label>",
		"<div id=\"work-control\"><div id=\"selected-work\">Select...</div><div>",
		"<input id=\"work\" type=\"text\" role=\"combobox\" aria-labelledby=\"work-label\" aria-required=\"true\" aria-controls=\"work-listbox\" aria-expanded=\"false\">",
		"</div></div>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"work-submitted\">not submitted</div>",
		"<script>",
		"const workInput = document.querySelector('#work');",
		"function closeWorkListbox() { document.querySelector('#work-listbox')?.remove(); workInput.setAttribute('aria-expanded', 'false'); }",
		"function renderWorkOptions() {",
		"  closeWorkListbox();",
		"  const listbox = document.createElement('div'); listbox.id = 'work-listbox'; listbox.setAttribute('role', 'listbox');",
		"  for (const label of ['Citizen', 'Work Visa']) {",
		"    const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"    option.addEventListener('click', () => { document.querySelector('#selected-work').textContent = label; workInput.value = ''; closeWorkListbox(); });",
		"    listbox.appendChild(option);",
		"  }",
		"  document.body.appendChild(listbox); workInput.setAttribute('aria-expanded', 'true');",
		"}",
		"workInput.addEventListener('click', renderWorkOptions);",
		"workInput.addEventListener('input', () => setTimeout(renderWorkOptions, 20));",
		"workInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeWorkListbox(); });",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createSearchableCityPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label id=\"city-label\" for=\"city\">Location (City)*</label>",
		"<div id=\"city-control\"><div id=\"selected-city\">Select...</div><div>",
		"<input id=\"city\" type=\"text\" role=\"combobox\" aria-labelledby=\"city-label\" aria-required=\"true\" aria-controls=\"city-listbox\" aria-expanded=\"false\">",
		"</div></div>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<script>",
		"const cityInput = document.querySelector('#city');",
		"function renderCityOptions() {",
		"  let listbox = document.querySelector('#city-listbox');",
		"  if (!listbox) { listbox = document.createElement('div'); listbox.id = 'city-listbox'; listbox.setAttribute('role', 'listbox'); document.body.appendChild(listbox); }",
		"  listbox.replaceChildren(); cityInput.setAttribute('aria-expanded', 'true');",
		"  if (cityInput.value !== 'Auckland') return;",
		"  for (const label of ['Auckland, Auckland Region, New Zealand', 'Auckland, California, United States', 'Bishop Auckland, Durham, United Kingdom']) {",
		"    const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"    option.addEventListener('click', () => { document.querySelector('#selected-city').textContent = label; cityInput.value = ''; listbox.remove(); cityInput.setAttribute('aria-expanded', 'false'); });",
		"    listbox.appendChild(option);",
		"  }",
		"}",
		"cityInput.addEventListener('click', renderCityOptions);",
		"cityInput.addEventListener('input', () => setTimeout(renderCityOptions, 20));",
		"cityInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('#city-listbox')?.remove(); });",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createAmbiguousSearchableCityPageUrl() {
	const html = [
		"<!doctype html><html><body><form>",
		"<label id=\"city-label\" for=\"candidate-location\">Location (City)*</label>",
		"<div><div id=\"selected-city\">Select...</div><div>",
		"<input id=\"candidate-location\" type=\"text\" role=\"combobox\" aria-labelledby=\"city-label\" aria-required=\"true\" aria-controls=\"city-listbox\" aria-expanded=\"false\"></div></div>",
		"<button type=\"submit\">Submit application</button></form>",
		"<script>",
		"const cityInput = document.querySelector('#candidate-location');",
		"const cityOptions = ['Auckland, Auckland Region, New Zealand', 'Auckland Airport, Auckland Region, New Zealand', 'Auckland Central, Auckland Region, New Zealand', 'Auckland Harbour, Auckland Region, New Zealand'];",
		"function renderCityOptions() {",
		"  let listbox = document.querySelector('#city-listbox');",
		"  if (!listbox) { listbox = document.createElement('div'); listbox.id = 'city-listbox'; listbox.setAttribute('role', 'listbox'); document.body.appendChild(listbox); }",
		"  listbox.replaceChildren(); cityInput.setAttribute('aria-expanded', 'true');",
		"  if (!cityInput.value.startsWith('Auckland')) return;",
		"  for (const label of cityOptions) {",
		"    const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"    option.addEventListener('click', () => { document.querySelector('#selected-city').textContent = label; cityInput.value = ''; listbox.remove(); cityInput.setAttribute('aria-expanded', 'false'); });",
		"    listbox.appendChild(option);",
		"  }",
		"}",
		"cityInput.addEventListener('click', renderCityOptions);",
		"cityInput.addEventListener('input', () => setTimeout(renderCityOptions, 20));",
		"cityInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('#city-listbox')?.remove(); });",
		"</script></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

function createSearchableSchoolPageUrl() {
	const html = [
		"<!doctype html><html><body><form>",
		"<label id=\"school-label\" for=\"school\">School</label>",
		"<div id=\"school-control\"><div id=\"selected-school\">Select...</div><div>",
		"<input id=\"school\" type=\"text\" role=\"combobox\" aria-labelledby=\"school-label\" aria-controls=\"school-listbox\"></div></div>",
		"<button type=\"submit\">Submit application</button></form>",
		"<script>",
		"const schoolInput = document.querySelector('#school');",
		"function renderSchoolOptions() {",
		"  let listbox = document.querySelector('#school-listbox');",
		"  if (!listbox) { listbox = document.createElement('div'); listbox.id = 'school-listbox'; listbox.setAttribute('role', 'listbox'); document.body.appendChild(listbox); }",
		"  listbox.replaceChildren(); if (schoolInput.value !== 'University of Auckland') return;",
		"  for (const label of ['The University of Auckland', 'Auckland University of Technology']) {",
		"    const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label;",
		"    option.addEventListener('click', () => { document.querySelector('#selected-school').textContent = label; schoolInput.value = ''; listbox.remove(); });",
		"    listbox.appendChild(option);",
		"  }",
		"}",
		"schoolInput.addEventListener('click', renderSchoolOptions);",
		"schoolInput.addEventListener('input', () => setTimeout(renderSchoolOptions, 20));",
		"schoolInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('#school-listbox')?.remove(); });",
		"</script></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

function createUnsupportedOptionalSelectionPageUrl() {
	const html = [
		"<!doctype html><html><body><form>",
		"<label id=\"degree-label\" for=\"degree\">Degree</label>",
		"<div><div>Select...</div><div><input id=\"degree\" type=\"text\" role=\"combobox\" aria-labelledby=\"degree-label\" aria-controls=\"degree-listbox\"></div></div>",
		"<button type=\"submit\">Submit application</button></form>",
		"<script>",
		"const degree = document.querySelector('#degree');",
		"function openDegree() {",
		"  document.querySelector('#degree-listbox')?.remove();",
		"  const listbox = document.createElement('div'); listbox.id = 'degree-listbox'; listbox.setAttribute('role', 'listbox');",
		"  for (const label of [\"Bachelor's Degree\", \"Master's Degree\"]) { const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = label; listbox.appendChild(option); }",
		"  document.body.appendChild(listbox);",
		"}",
		"degree.addEventListener('click', openDegree); degree.addEventListener('input', openDegree);",
		"degree.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('#degree-listbox')?.remove(); });",
		"</script></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

function createReviewResolutionPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<label for=\"workAuth\">Are you legally authorized to work in New Zealand?</label>",
		"<select id=\"workAuth\" name=\"workAuth\" required>",
		"<option value=\"\">Select...</option>",
		"<option>Yes</option>",
		"<option>No</option>",
		"</select>",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"submitted\">not submitted</div>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
