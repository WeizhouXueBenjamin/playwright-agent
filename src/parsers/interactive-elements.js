async function captureInteractiveElements(page) {
	return page.evaluate(() => {
		const interactiveSelector = [
			"a[href]",
			"button",
			"input",
			"select",
			"textarea",
			"summary",
			"[contenteditable='']",
			"[contenteditable='true']",
			"[role='button']",
			"[role='checkbox']",
			"[role='combobox']",
			"[role='link']",
			"[role='listbox']",
			"[role='menuitem']",
			"[role='option']",
			"[role='radio']",
			"[role='searchbox']",
			"[role='slider']",
			"[role='spinbutton']",
			"[role='switch']",
			"[role='tab']",
			"[role='textbox']",
		].join(",");

		const elements = Array.from(document.querySelectorAll(interactiveSelector))
			.filter((element) => isElementVisible(element))
			.map((element, index) => serializeInteractiveElement(element, index));

		const forms = Array.from(document.forms).map((form, index) => ({
			id: `form-${index + 1}`,
			name: form.getAttribute("name") || "",
			ariaLabel: form.getAttribute("aria-label") || "",
			label: getFormLabel(form),
			action: form.getAttribute("action") || "",
			method: form.getAttribute("method") || "get",
			controlIndexes: elements
				.filter((element) => element.formIndex === index)
				.map((element) => element.index),
		}));

		return { elements, forms };

		function serializeInteractiveElement(element, index) {
			const rect = element.getBoundingClientRect();
			const labels = collectLabelCandidates(element);
			const tagName = element.tagName.toLowerCase();
			const role = element.getAttribute("role") || getImplicitRole(element);
			const type = element.getAttribute("type") || "";
			const form = element.closest("form");

			return {
				id: `interactive-${index + 1}`,
				index,
				kind: inferKind(element, role),
				tagName,
				type,
				role,
				name: element.getAttribute("name") || "",
				idAttribute: element.id || "",
				required: element.hasAttribute("required") || element.getAttribute("aria-required") === "true",
				disabled: isDisabled(element),
				readonly: element.hasAttribute("readonly") || element.getAttribute("aria-readonly") === "true",
				placeholder: element.getAttribute("placeholder") || "",
				ariaLabel: element.getAttribute("aria-label") || "",
				ariaLabelledBy: element.getAttribute("aria-labelledby") || "",
				text: normalizeText(element.innerText || element.textContent || ""),
				state: getElementState(element),
				validation: getElementValidation(element),
				labels,
				options: collectOptions(element),
				bounds: {
					x: Math.round(rect.x),
					y: Math.round(rect.y),
					width: Math.round(rect.width),
					height: Math.round(rect.height),
				},
				formIndex: form ? Array.from(document.forms).indexOf(form) : -1,
				semanticPath: getSemanticPath(element),
			};
		}

		function collectLabelCandidates(element) {
			const candidates = [];

			for (const label of getNativeLabels(element)) {
				addCandidate(candidates, label, "label", 0.98);
			}

			for (const text of getAriaLabelledByTexts(element)) {
				addCandidate(candidates, text, "aria-labelledby", 0.96);
			}

			addCandidate(candidates, element.getAttribute("aria-label"), "aria-label", 0.94);
			addCandidate(candidates, getOwnVisibleText(element), "visible-text", 0.9);
			addCandidate(candidates, element.getAttribute("placeholder"), "placeholder", 0.72);
			addCandidate(candidates, getFieldsetLegend(element), "fieldset-legend", 0.68);
			addCandidate(candidates, getNearbyText(element), "nearby-text", 0.58);
			addCandidate(candidates, element.getAttribute("name"), "name", 0.45);

			return candidates;
		}

		function getNativeLabels(element) {
			const labels = [];

			if ("labels" in element && element.labels) {
				for (const label of element.labels) {
					labels.push(normalizeText(label.innerText || label.textContent || ""));
				}
			}

			if (element.id) {
				for (const label of document.querySelectorAll(`label[for="${cssEscape(element.id)}"]`)) {
					labels.push(normalizeText(label.innerText || label.textContent || ""));
				}
			}

			const wrappingLabel = element.closest("label");
			if (wrappingLabel) {
				labels.push(normalizeText(wrappingLabel.innerText || wrappingLabel.textContent || ""));
			}

			return labels;
		}

		function getAriaLabelledByTexts(element) {
			const ids = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
			return ids
				.map((id) => document.getElementById(id))
				.filter(Boolean)
				.map((labelElement) => normalizeText(labelElement.innerText || labelElement.textContent || ""));
		}

		function getFieldsetLegend(element) {
			const fieldset = element.closest("fieldset");
			const legend = fieldset ? fieldset.querySelector("legend") : null;
			return legend ? normalizeText(legend.innerText || legend.textContent || "") : "";
		}

		function getOwnVisibleText(element) {
			return normalizeText(element.innerText || element.textContent || "");
		}

		function getNearbyText(element) {
			const parent = element.parentElement;
			if (!parent) return "";

			const ownText = normalizeText(parent.innerText || parent.textContent || "");
			const elementText = normalizeText(element.innerText || element.textContent || "");
			return normalizeText(ownText.replace(elementText, ""));
		}

		function collectOptions(element) {
			if (element.tagName.toLowerCase() !== "select") return [];

			return Array.from(element.options).map((option) => ({
				label: normalizeText(option.label || option.textContent || ""),
				valuePresent: Boolean(option.value),
				disabled: option.disabled,
			}));
		}

		function getElementState(element) {
			const tagName = element.tagName.toLowerCase();
			const type = (element.getAttribute("type") || "").toLowerCase();

			if (type === "checkbox" || type === "radio") {
				return { checked: Boolean(element.checked) };
			}

			if (tagName === "select") {
				const selected = element.options[element.selectedIndex];
				return {
					value: element.value,
					selectedLabel: selected ? normalizeText(selected.label || selected.textContent || "") : "",
				};
			}

			if (tagName === "input" || tagName === "textarea") {
				if (type === "file") {
					return {
						files: Array.from(element.files || []).map((file) => ({
							name: file.name,
							size: file.size,
						})),
					};
				}

				return { value: element.value };
			}

			if (element.isContentEditable) {
				return { value: normalizeText(element.innerText || element.textContent || "") };
			}

			return {};
		}

		function getElementValidation(element) {
			if (!("validity" in element)) {
				return {
					valid: true,
					message: "",
				};
			}

			return {
				valid: element.validity.valid,
				message: element.validationMessage || "",
			};
		}

		function getFormLabel(form) {
			const ariaLabel = form.getAttribute("aria-label");
			if (ariaLabel) return normalizeText(ariaLabel);

			const labelledBy = form.getAttribute("aria-labelledby");
			if (labelledBy) {
				const label = document.getElementById(labelledBy);
				if (label) return normalizeText(label.innerText || label.textContent || "");
			}

			const heading = form.querySelector("h1,h2,h3,legend");
			return heading ? normalizeText(heading.innerText || heading.textContent || "") : "";
		}

		function addCandidate(candidates, text, source, confidence) {
			const normalized = normalizeText(text || "");
			if (!normalized) return;
			if (candidates.some((candidate) => candidate.text.toLowerCase() === normalized.toLowerCase())) return;

			candidates.push({ text: normalized, source, confidence });
		}

		function inferKind(element, role) {
			const tagName = element.tagName.toLowerCase();
			const type = (element.getAttribute("type") || "").toLowerCase();

			if (type === "file") return "file-upload";
			if (tagName === "textarea" || role === "textbox" || ["email", "password", "search", "tel", "text", "url"].includes(type)) return "text-input";
			if (["checkbox", "radio"].includes(type)) return type;
			if (tagName === "select" || role === "combobox" || role === "listbox") return "selection";
			if (tagName === "button" || role === "button" || ["button", "submit", "reset"].includes(type)) return "button";
			if (tagName === "a" || role === "link") return "link";
			if (element.isContentEditable) return "editable";
			return "interactive";
		}

		function getImplicitRole(element) {
			const tagName = element.tagName.toLowerCase();
			const type = (element.getAttribute("type") || "").toLowerCase();

			if (tagName === "button") return "button";
			if (tagName === "a" && element.hasAttribute("href")) return "link";
			if (tagName === "select") return "combobox";
			if (tagName === "textarea") return "textbox";
			if (tagName === "input" && type === "checkbox") return "checkbox";
			if (tagName === "input" && type === "radio") return "radio";
			if (tagName === "input") return "textbox";
			return "";
		}

		function getSemanticPath(element) {
			const path = [];
			let current = element;

			while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
				const tagName = current.tagName.toLowerCase();
				const role = current.getAttribute("role");
				const label = current.getAttribute("aria-label");
				path.unshift({ tagName, role: role || "", label: label || "" });
				current = current.parentElement;
			}

			return path;
		}

		function isDisabled(element) {
			return Boolean(element.disabled) || element.getAttribute("aria-disabled") === "true";
		}

		function isElementVisible(element) {
			const style = window.getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
		}

		function normalizeText(text) {
			return String(text).replace(/\s+/g, " ").trim();
		}

		function cssEscape(value) {
			if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
			return String(value).replace(/["\\]/g, "\\$&");
		}
	});
}

module.exports = {
	captureInteractiveElements,
};
