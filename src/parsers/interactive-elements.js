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

		const interactiveNodes = Array.from(document.querySelectorAll(interactiveSelector))
			.filter((element) => isElementVisible(element));
		const elements = interactiveNodes.map((element, index) => serializeInteractiveElement(element, index));
		const choiceGroups = detectChoiceGroups(interactiveNodes, elements);

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

		return { elements, forms, choiceGroups };

		function serializeInteractiveElement(element, index) {
			const rect = element.getBoundingClientRect();
			const labels = collectLabelCandidates(element);
			const tagName = element.tagName.toLowerCase();
			const role = element.getAttribute("role") || getImplicitRole(element);
			const type = element.getAttribute("type") || "";
			const form = element.form || element.closest("form");

			return {
				id: `interactive-${index + 1}`,
				index,
				kind: inferKind(element, role),
				tagName,
				type,
				role,
				name: element.getAttribute("name") || "",
				value: element.getAttribute("value") || "",
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

		function detectChoiceGroups(nodes, serializedElements) {
			const candidates = nodes.map((node, index) => ({ node, element: serializedElements[index] }))
				.filter(({ element }) => element.kind === "radio" || element.kind === "checkbox");
			const assigned = new Set();
			const groups = [];

			addGroupedCandidates("native-name", ({ node, element }) => {
				const name = String(node.getAttribute("name") || "").trim();
				return name ? `${getFormOwnerKey(node)}:${element.kind}:${name}` : "";
			});
			addGroupedCandidates("fieldset", ({ node, element }) => {
				const fieldset = node.closest("fieldset");
				return fieldset && getDirectLegendText(fieldset) ? `${getNodeKey(fieldset)}:${element.kind}` : "";
			});
			addGroupedCandidates("aria-group", ({ node, element }) => {
				const group = node.closest('[role="radiogroup"],[role="group"]');
				return group && getAccessibleName(group) ? `${getNodeKey(group)}:${element.kind}` : "";
			});
			addGroupedCandidates("shared-aria-labelledby", ({ node, element }) => {
				const labelledBy = normalizeIdRefs(node.getAttribute("aria-labelledby"));
				return labelledBy && getReferencedText(labelledBy)
					? `${getFormOwnerKey(node)}:${element.kind}:${labelledBy}`
					: "";
			});

			return groups;

			function addGroupedCandidates(rule, getKey) {
				const byKey = new Map();
				for (const candidate of candidates) {
					if (assigned.has(candidate.element.id)) continue;
					const key = getKey(candidate);
					if (!key) continue;
					if (!byKey.has(key)) byKey.set(key, []);
					byKey.get(key).push(candidate);
				}

				for (const members of byKey.values()) {
					if (members.length < 2) continue;
					if (new Set(members.map(({ element }) => element.kind)).size !== 1) continue;
					const id = `choice-group-${groups.length + 1}`;
					groups.push({
						id,
						mode: members[0].element.kind === "radio" ? "single" : "multiple",
						question: getGroupQuestion(members.map(({ node }) => node)),
						rule,
						memberIds: members.map(({ element }) => element.id),
					});
					for (const { element } of members) {
						element.choiceGroupId = id;
						assigned.add(element.id);
					}
				}
			}
		}

		function getGroupQuestion(nodes) {
			const fieldsets = new Set(nodes.map((node) => node.closest("fieldset")).filter(Boolean));
			if (fieldsets.size === 1) {
				const legend = getDirectLegendText([...fieldsets][0]);
				if (legend) return legend;
			}

			const ariaGroups = new Set(nodes.map((node) => node.closest('[role="radiogroup"],[role="group"]')).filter(Boolean));
			if (ariaGroups.size === 1) {
				const name = getAccessibleName([...ariaGroups][0]);
				if (name) return name;
			}

			const labelledByValues = new Set(nodes.map((node) => normalizeIdRefs(node.getAttribute("aria-labelledby"))).filter(Boolean));
			if (labelledByValues.size === 1) {
				const text = getReferencedText([...labelledByValues][0]);
				if (text) return text;
			}

			return getStructuralPreamble(nodes);
		}

		function getStructuralPreamble(nodes) {
			const ancestor = getLowestCommonAncestor(nodes);
			if (!ancestor) return "";
			const branches = nodes.map((node) => getDirectChildContaining(ancestor, node)).filter(Boolean);
			const children = Array.from(ancestor.children || []);
			const indexes = branches.map((branch) => children.indexOf(branch)).filter((index) => index >= 0);
			if (!indexes.length) return "";
			const firstOptionIndex = Math.min(...indexes);
			if (firstOptionIndex <= 0) return "";
			return normalizeText(children.slice(0, firstOptionIndex)
				.filter((child) => !child.querySelector('input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]'))
				.map((child) => child.innerText || child.textContent || "")
				.join(" ")).slice(0, 320);
		}

		function getLowestCommonAncestor(nodes) {
			if (!nodes.length) return null;
			let current = nodes[0].parentElement;
			while (current && !nodes.every((node) => current.contains(node))) current = current.parentElement;
			return current;
		}

		function getDirectChildContaining(ancestor, node) {
			let current = node;
			while (current && current.parentElement !== ancestor) current = current.parentElement;
			return current && current.parentElement === ancestor ? current : null;
		}

		function getDirectLegendText(fieldset) {
			const legend = Array.from(fieldset.children || [])
				.find((child) => child.tagName && child.tagName.toLowerCase() === "legend");
			return legend ? normalizeText(legend.innerText || legend.textContent || "") : "";
		}

		function getAccessibleName(element) {
			const ariaLabel = normalizeText(element.getAttribute("aria-label") || "");
			return ariaLabel || getReferencedText(normalizeIdRefs(element.getAttribute("aria-labelledby")));
		}

		function normalizeIdRefs(value) {
			return String(value || "").split(/\s+/).filter(Boolean).join(" ");
		}

		function getReferencedText(idRefs) {
			if (!idRefs) return "";
			return normalizeText(idRefs.split(/\s+/)
				.map((id) => document.getElementById(id))
				.filter(Boolean)
				.map((element) => element.innerText || element.textContent || "")
				.join(" "));
		}

		function getFormOwnerKey(element) {
			const owner = element.form || element.closest("form");
			return owner ? `form-${Array.from(document.forms).indexOf(owner)}` : "document-root";
		}

		function getNodeKey(element) {
			return element.id || `node-${Array.from(document.querySelectorAll("*")).indexOf(element)}`;
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
			const role = element.getAttribute("role") || "";

			if (type === "checkbox" || type === "radio" || role === "checkbox" || role === "radio") {
				return {
					checked: "checked" in element
						? Boolean(element.checked)
						: element.getAttribute("aria-checked") === "true",
				};
			}

			if (tagName === "select") {
				const selected = element.options[element.selectedIndex];
				return {
					value: element.value,
					selectedLabel: selected ? normalizeText(selected.label || selected.textContent || "") : "",
				};
			}

			if (role === "combobox" || role === "listbox") {
				return {
					value: element.value || "",
					selectedLabel: getCustomSelectionLabel(element),
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

		function getCustomSelectionLabel(element) {
			const explicitValue = normalizeText(element.getAttribute("aria-valuetext") || element.value || "");
			if (explicitValue) return explicitValue;
			const container = element.parentElement && element.parentElement.parentElement;
			const containerText = normalizeText(container && container.innerText || "");
			if (!containerText || /^select(\.{3})?$/i.test(containerText)) return "";
			return containerText;
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
			if (tagName === "select" || role === "combobox" || role === "listbox") return "selection";
			if (tagName === "textarea" || role === "textbox" || ["email", "password", "search", "tel", "text", "url"].includes(type)) return "text-input";
			if (["checkbox", "radio"].includes(type)) return type;
			if (["checkbox", "radio"].includes(role)) return role;
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
			if (element.getAttribute("aria-hidden") === "true" || element.closest("[aria-hidden='true']")) return false;
			if (element.getAttribute("type") === "hidden") return false;
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
