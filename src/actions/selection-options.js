const crypto = require("node:crypto");

const { resolveFieldLocator } = require("./locator");
const { normalizeOptionText, resolveOption } = require("./option-resolver");

const OPTION_STABILITY_WINDOW_MS = 250;

async function inspectSelectionOptions(page, field) {
	const { locator } = await resolveFieldLocator(page, field);
	if (await isNativeSelect(locator)) {
		const options = await locator.evaluate((element) => Array.from(element.options || []).map((option) => ({
			optionId: option.id || option.value || option.label,
			label: String(option.label || option.textContent || "").trim(),
			value: option.value,
			disabled: option.disabled,
			placeholder: !option.value && /^select(\s|\.|$)/i.test(String(option.label || option.textContent || "").trim()),
		})));
		return buildSnapshot(field, options, true);
	}

	const before = await readCustomSelection(locator);
	await locator.click();
	const listbox = await resolveAssociatedListbox(page, locator);
	const options = await listbox.getByRole("option").evaluateAll((elements) => elements.map((option) => ({
		optionId: option.id || option.getAttribute("data-value") || option.textContent,
		label: String(option.innerText || option.textContent || "").replace(/\s+/g, " ").trim(),
		value: option.getAttribute("data-value") || option.getAttribute("value") || "",
		disabled: option.getAttribute("aria-disabled") === "true" || option.hasAttribute("disabled"),
		placeholder: false,
	})));
	await locator.press("Escape").catch(() => {});
	const after = await readCustomSelection(locator);
	if (before !== after) throw new Error("option-inspection-changed-selection");
	return buildSnapshot(field, options, true);
}

async function selectCustomOption(page, field, expectedLabel, selectionContext = {}, matchContext = {}) {
	const { locator, strategy } = await resolveFieldLocator(page, field);
	await locator.click();
	let listbox = await tryResolveAssociatedListbox(page, locator);
	let liveOptions = listbox ? await readEnabledOptions(listbox) : [];
	if (!hasCompatibleOption(liveOptions, expectedLabel, { ...matchContext, selectionContext }) && await isEditableCombobox(locator)) {
		await locator.fill("");
		await locator.pressSequentially(String(expectedLabel), { delay: 25 });
		({ listbox, liveOptions } = await waitForSearchOptions(page, locator, expectedLabel, { ...matchContext, selectionContext }));
	}
	if (!listbox) throw new Error("Unable to associate a visible listbox with the active control.");
	const resolvedOption = resolveLiveOption(liveOptions, expectedLabel, { ...matchContext, selectionContext });
	const resolvedLabel = resolvedOption.label;
	const option = listbox.getByRole("option", { name: resolvedLabel, exact: true });
	const count = await option.count();
	if (count !== 1) throw new Error(`Expected one live option matching "${resolvedLabel}", found ${count}.`);
	const disabled = await option.evaluate((element) => element.getAttribute("aria-disabled") === "true" || element.hasAttribute("disabled"));
	if (disabled) throw new Error(`Option "${expectedLabel}" is disabled.`);
	await option.click();
	return {
		action: "select-option",
		locatorStrategy: `${strategy}:aria-option`,
		selectedOptionLabel: resolvedLabel,
		selectedOptionValue: resolvedOption.value,
		selectedOptionId: resolvedOption.optionId,
	};
}

async function readEnabledOptionLabels(listbox) {
	const options = await readEnabledOptions(listbox);
	return options.map((option) => option.label);
}

async function readEnabledOptions(listbox) {
	return listbox.getByRole("option").evaluateAll((elements) => elements
		.filter((element) => element.getAttribute("aria-disabled") !== "true" && !element.hasAttribute("disabled"))
		.map((element) => ({
			optionId: element.id || element.getAttribute("data-value") || element.textContent,
			label: String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim(),
			value: element.getAttribute("data-value") || element.getAttribute("value") || "",
		}))
		.filter((option) => option.label));
}

async function isEditableCombobox(locator) {
	return locator.evaluate((element) => element.getAttribute("role") === "combobox"
		&& !element.hasAttribute("readonly")
		&& !element.disabled
		&& typeof element.value === "string");
}

async function waitForSearchOptions(page, locator, expectedLabel, matchContext = {}, timeoutMs = 2500) {
	const deadline = Date.now() + timeoutMs;
	let listbox;
	let liveOptions = [];
	do {
		listbox = await tryResolveAssociatedListbox(page, locator);
		liveOptions = listbox ? await readEnabledOptions(listbox) : [];
		if (hasCompatibleOption(liveOptions, expectedLabel, matchContext)) {
			const stable = await waitForStableOptionSnapshot(page, listbox, OPTION_STABILITY_WINDOW_MS, deadline);
			return { listbox, liveOptions: stable.options, stableSnapshot: stable.stable };
		}
		await page.waitForTimeout(100);
	} while (Date.now() < deadline);
	return { listbox, liveOptions };
}

async function waitForStableOptionSnapshot(page, listbox, stabilityWindowMs, deadline) {
	let previousId = "";
	let stableSince = 0;
	let latestOptions = [];

	while (Date.now() < deadline) {
		latestOptions = await readEnabledOptions(listbox);
		const snapshotId = buildOptionSnapshotId(latestOptions);
		if (snapshotId && snapshotId === previousId) {
			if (!stableSince) stableSince = Date.now();
			if (Date.now() - stableSince >= stabilityWindowMs) {
				return { stable: true, options: latestOptions, snapshotId };
			}
		} else {
			previousId = snapshotId;
			stableSince = Date.now();
		}
		await page.waitForTimeout(50);
	}
	return { stable: false, options: latestOptions, snapshotId: buildOptionSnapshotId(latestOptions) };
}

async function tryResolveAssociatedListbox(page, locator) {
	try {
		return await resolveAssociatedListbox(page, locator);
	} catch {
		return null;
	}
}

async function verifyCustomSelection(locator, selectedOptionLabel = "", selectedOptionValue = "") {
	const actual = await readCustomSelection(locator);
	return {
		matched: selectedOptionEvidenceMatches(actual, selectedOptionLabel, selectedOptionValue),
		actual,
	};
}

async function resetCustomSelectionSearch(page, field) {
	const { locator } = await resolveFieldLocator(page, field);
	if (await isNativeSelect(locator)) return;
	await locator.fill("");
	await locator.press("Escape").catch(() => {});
}

async function isNativeSelect(locator) {
	return locator.evaluate((element) => element.tagName.toLowerCase() === "select");
}

async function resolveAssociatedListbox(page, locator) {
	await page.waitForTimeout(50);
	const relationId = await locator.evaluate((element) => element.getAttribute("aria-controls") || element.getAttribute("aria-owns") || "");
	if (relationId) {
		const related = page.locator(`[id=${JSON.stringify(relationId)}]`);
		if (await related.count() === 1 && await related.isVisible()) return related;
	}
	const visibleListboxes = page.locator('[role="listbox"]:visible');
	const count = await visibleListboxes.count();
	if (count !== 1) throw new Error(`Unable to associate one visible listbox with the active control; found ${count}.`);
	return visibleListboxes.first();
}

async function readCustomSelection(locator) {
	return locator.evaluate((element) => {
		const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
		const explicitValue = normalizeText(element.getAttribute("aria-valuetext") || element.value || "");
		if (explicitValue) return explicitValue;
		const container = element.parentElement && element.parentElement.parentElement;
		const text = normalizeText(container && container.innerText || "");
		return /^select(\.{3})?$/i.test(text) ? "" : text;
	});
}

function buildSnapshot(field, options, complete) {
	const selectableOptions = options.filter((option) => option.label && !option.disabled && !option.placeholder);
	return {
		snapshotId: buildOptionSnapshotId(selectableOptions),
		complete,
		options: selectableOptions,
	};
}

function buildOptionSnapshotId(options) {
	return crypto.createHash("sha1").update(JSON.stringify(options || [])).digest("hex");
}

function resolveLiveOption(options, expectedLabel, matchContext = {}) {
	const result = resolveOption(options, expectedLabel, matchContext);
	if (result.status === "matched") {
		const option = options.find((candidate) => candidate.label === result.optionLabel);
		if (option) return option;
	}
	const error = new Error(`Expected one compatible live option for "${expectedLabel}", found ${result.candidates.length}.`);
	error.optionMatch = summarizeOptionMatch(result, options);
	throw error;
}

function hasCompatibleOption(options, expectedLabel, matchContext = {}) {
	return resolveOption(options, expectedLabel, matchContext).status === "matched";
}

function selectedOptionEvidenceMatches(actualValue, selectedOptionLabel, selectedOptionValue = "") {
	const actual = normalizeOptionText(actualValue);
	const selected = normalizeOptionText(selectedOptionLabel);
	const selectedValue = normalizeOptionText(selectedOptionValue);
	if (!actual || !selected) return false;
	if (actual === selected) return true;
	if (selectedValue && actual === selectedValue) return true;
	return [" ", ",", " (", " -", " /"].some((boundary) => selected.endsWith(`${boundary}${actual}`));
}

module.exports = {
	OPTION_STABILITY_WINDOW_MS,
	inspectSelectionOptions,
	resetCustomSelectionSearch,
	selectCustomOption,
	verifyCustomSelection,
};

function summarizeOptionMatch(result, options) {
	return {
		status: result.status,
		tier: result.tier,
		reason: result.reason,
		optionLabel: result.optionLabel,
		candidateCount: (options || []).length,
		candidates: result.candidates || [],
	};
}
