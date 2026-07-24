const crypto = require("node:crypto");

const { resolveFieldLocator } = require("./locator");

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

async function selectCustomOption(page, field, expectedLabel, selectionContext = {}) {
	const { locator, strategy } = await resolveFieldLocator(page, field);
	await locator.click();
	let listbox = await tryResolveAssociatedListbox(page, locator);
	let liveLabels = listbox ? await readEnabledOptionLabels(listbox) : [];
	if (!hasCompatibleOption(liveLabels, expectedLabel) && await isEditableCombobox(locator)) {
		await locator.fill("");
		await locator.pressSequentially(String(expectedLabel), { delay: 25 });
		({ listbox, liveLabels } = await waitForSearchOptions(page, locator, expectedLabel));
	}
	if (!listbox) throw new Error("Unable to associate a visible listbox with the active control.");
	const resolvedLabel = resolveLiveOptionLabel(liveLabels, expectedLabel, selectionContext);
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
	};
}

async function readEnabledOptionLabels(listbox) {
	return listbox.getByRole("option").evaluateAll((elements) => elements
		.filter((element) => element.getAttribute("aria-disabled") !== "true" && !element.hasAttribute("disabled"))
		.map((element) => String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim())
		.filter(Boolean));
}

async function isEditableCombobox(locator) {
	return locator.evaluate((element) => element.getAttribute("role") === "combobox"
		&& !element.hasAttribute("readonly")
		&& !element.disabled
		&& typeof element.value === "string");
}

async function waitForSearchOptions(page, locator, expectedLabel, timeoutMs = 2500) {
	const deadline = Date.now() + timeoutMs;
	let listbox;
	let liveLabels = [];
	do {
		listbox = await tryResolveAssociatedListbox(page, locator);
		liveLabels = listbox ? await readEnabledOptionLabels(listbox) : [];
		if (hasCompatibleOption(liveLabels, expectedLabel)) return { listbox, liveLabels };
		await page.waitForTimeout(100);
	} while (Date.now() < deadline);
	return { listbox, liveLabels };
}

async function tryResolveAssociatedListbox(page, locator) {
	try {
		return await resolveAssociatedListbox(page, locator);
	} catch {
		return null;
	}
}

async function verifyCustomSelection(locator, expectedLabel, selectedOptionLabel = "") {
	const actual = await readCustomSelection(locator);
	return {
		matched: optionLabelMatches(actual, expectedLabel)
			|| selectedOptionEvidenceMatches(actual, selectedOptionLabel),
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
		snapshotId: crypto.createHash("sha1").update(JSON.stringify(selectableOptions)).digest("hex"),
		complete,
		options: selectableOptions,
	};
}

function normalize(value) {
	return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function resolveLiveOptionLabel(labels, expectedLabel, selectionContext = {}) {
	const exact = labels.filter((label) => normalize(label) === normalize(expectedLabel));
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) throw new Error(`Multiple live options exactly matched "${expectedLabel}".`);
	const compatible = labels.filter((label) => optionLabelMatches(label, expectedLabel));
	if (compatible.length === 1) return compatible[0];
	const structured = compatible.filter((label) => normalize(label).startsWith(`${normalize(expectedLabel)},`));
	const candidates = structured.length ? structured : compatible;
	const contextual = narrowBySelectionContext(candidates, selectionContext);
	if (contextual.length !== 1) {
		throw new Error(`Expected one compatible live option for "${expectedLabel}", found ${compatible.length}.`);
	}
	return contextual[0];
}

function narrowBySelectionContext(labels, selectionContext) {
	const values = Object.values(selectionContext || {}).map(normalize).filter(Boolean);
	if (!values.length) return labels;
	return labels.filter((label) => values.every((value) => containsDelimitedValue(normalize(label), value)));
}

function containsDelimitedValue(label, value) {
	const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|[,(/ -])${escaped}($|[,)/ -])`, "i").test(label);
}

function hasCompatibleOption(labels, expectedLabel) {
	return labels.some((label) => optionLabelMatches(label, expectedLabel));
}

function optionLabelMatches(actualLabel, expectedLabel) {
	const actual = normalize(actualLabel);
	const expected = normalize(expectedLabel);
	if (!actual || !expected) return false;
	if (actual === expected) return true;
	if (actual === `the ${expected}`) return true;
	return [" ", ",", " (", " -", " /"].some((boundary) => actual.startsWith(`${expected}${boundary}`));
}

function selectedOptionEvidenceMatches(actualValue, selectedOptionLabel) {
	const actual = normalize(actualValue);
	const selected = normalize(selectedOptionLabel);
	if (!actual || !selected) return false;
	if (actual === selected) return true;
	return [" ", ",", " (", " -", " /"].some((boundary) => selected.endsWith(`${boundary}${actual}`));
}

module.exports = {
	inspectSelectionOptions,
	resetCustomSelectionSearch,
	selectCustomOption,
	verifyCustomSelection,
};
