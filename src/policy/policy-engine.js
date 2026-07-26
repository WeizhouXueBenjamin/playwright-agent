const SAFE_NAVIGATION_PATTERNS = [
	/\bcontinue\b/i,
	/\bnext\b/i,
	/\bsave and continue\b/i,
	/\bproceed\b/i,
];

const APPLICATION_ENTRY_LINK_PATTERNS = [
	/^\s*apply now\s*$/i,
	/^\s*start application\s*$/i,
	/^\s*begin application\s*$/i,
];

const FINAL_SUBMIT_PATTERNS = [
	/\bsubmit\b/i,
	/\bapply\b/i,
	/\bsend\b/i,
	/\bfinish\b/i,
	/\bconfirm\b/i,
];

const IRREVERSIBLE_ACTION_PATTERNS = [
	...FINAL_SUBMIT_PATTERNS,
	/\bcreate account\b/i,
	/\bsign up\b/i,
	/\bregister\b/i,
	/\bpay\b/i,
	/\bpurchase\b/i,
	/\bcheckout\b/i,
	/\bauthori[sz]e\b/i,
	/\bcontinue with\b/i,
	/\bsign in with\b/i,
	/\blog in with\b/i,
];

function evaluateActionTargetPolicy(target) {
	const label = getControlLabel(target);
	const isCommandControl = target && ["button", "link"].includes(target.kind);
	const isApplicationEntryLink = target && target.kind === "link" && matchesAny(label, APPLICATION_ENTRY_LINK_PATTERNS);
	const isFinalSubmit = isCommandControl && matchesAny(label, FINAL_SUBMIT_PATTERNS);
	const isIrreversible = isCommandControl && matchesAny(label, IRREVERSIBLE_ACTION_PATTERNS);

	if (isApplicationEntryLink) {
		return {
			status: "allowed",
			allowed: true,
			policy: "safe-application-entry",
			reason: "application-entry-link",
			risk: "low",
			target,
			isFinalSubmit: false,
		};
	}

	if (isIrreversible) {
		return {
			status: "requires-confirmation",
			allowed: false,
			policy: isFinalSubmit ? "stop-before-final-submission" : "prevent-irreversible-actions",
			reason: "irreversible-action-needs-confirmation",
			risk: "high",
			target,
			isFinalSubmit,
		};
	}

	return {
		status: "allowed",
		allowed: true,
		policy: "safe-browser-action",
		reason: "target-allowed",
		risk: "low",
		target,
		isFinalSubmit: false,
	};
}

function evaluateNavigationPolicy(control) {
	if (!control || !["button", "link"].includes(control.kind) || control.disabled) {
		return {
			status: "not-applicable",
			allowed: false,
			policy: "safe-navigation",
			reason: "not-navigation-control",
			risk: "low",
			control,
		};
	}

	const actionPolicy = evaluateActionTargetPolicy(control);
	if (!actionPolicy.allowed) return { ...actionPolicy, control };

	const label = getControlLabel(control);
	const isApplicationEntryLink = control.kind === "link" && matchesAny(label, APPLICATION_ENTRY_LINK_PATTERNS);
	const isSafeNavigation = matchesAny(label, SAFE_NAVIGATION_PATTERNS) || isApplicationEntryLink;
	return {
		status: isSafeNavigation ? "allowed" : "not-applicable",
		allowed: isSafeNavigation,
		policy: isApplicationEntryLink ? "safe-application-entry" : "safe-navigation",
		reason: isApplicationEntryLink ? "application-entry-link" : isSafeNavigation ? "safe-navigation-control" : "not-navigation-control",
		risk: "low",
		control,
	};
}

function evaluatePagePolicy(semanticPage) {
	const irreversibleControl = findIrreversibleControl(semanticPage);
	if (!irreversibleControl) {
		return {
			status: "allowed",
			allowed: true,
			policy: "safe-browser-page",
			reason: "no-irreversible-control-detected",
			risk: "low",
		};
	}

	return {
		status: "requires-confirmation",
		allowed: false,
		policy: irreversibleControl.isFinalSubmit ? "stop-before-final-submission" : "prevent-irreversible-actions",
		reason: irreversibleControl.isFinalSubmit
			? "final-submission-control-detected"
			: "irreversible-control-detected",
		risk: "high",
		control: irreversibleControl.control,
		isFinalSubmit: irreversibleControl.isFinalSubmit,
	};
}

function findIrreversibleControl(semanticPage) {
	const control = (semanticPage.interactiveElements || []).find((element) => {
		if (element.kind !== "button") return false;
		return !evaluateActionTargetPolicy(element).allowed;
	});

	if (!control) return null;
	return {
		control,
		isFinalSubmit: matchesAny(getControlLabel(control), FINAL_SUBMIT_PATTERNS),
	};
}

function getControlLabel(control) {
	return control && control.label && control.label.text ? control.label.text : "";
}

function matchesAny(value, patterns) {
	return patterns.some((pattern) => pattern.test(value));
}

module.exports = {
	evaluateActionTargetPolicy,
	evaluateNavigationPolicy,
	evaluatePagePolicy,
	findIrreversibleControl,
};
