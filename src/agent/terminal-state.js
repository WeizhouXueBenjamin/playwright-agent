const FINAL_SUBMIT_PATTERNS = [
	/\bsubmit\b/i,
	/\bapply\b/i,
	/\bsend\b/i,
	/\bfinish\b/i,
	/\bconfirm\b/i,
];

const IRREVERSIBLE_CONTROL_PATTERNS = [
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

function detectTerminalState(semanticPage, decision) {
	if (decision.type === "needs-review") {
		if (decision.reason === "irreversible-action-needs-confirmation") {
			return {
				reached: true,
				status: "awaiting-human-confirmation",
				reason: decision.reason,
				details: decision.details,
			};
		}

		return {
			reached: true,
			status: "needs-review",
			reason: decision.reason,
			details: decision.details,
		};
	}

	if (decision.type === "none") {
		const irreversibleControl = findIrreversibleControl(semanticPage);
		if (irreversibleControl) {
			return {
				reached: true,
				status: "awaiting-human-confirmation",
				reason: irreversibleControl.isFinalSubmit
					? "final-submission-control-detected"
					: "irreversible-control-detected",
				details: { control: irreversibleControl.control },
			};
		}

		return {
			reached: true,
			status: "completed",
			reason: "no-actionable-fields-or-navigation",
			details: {},
		};
	}

	return {
		reached: false,
		status: "running",
		reason: "actionable-decision",
		details: {},
	};
}

function findIrreversibleControl(semanticPage) {
	const control = (semanticPage.interactiveElements || []).find((element) => {
		if (element.kind !== "button") return false;
		const label = element.label && element.label.text ? element.label.text : "";
		return IRREVERSIBLE_CONTROL_PATTERNS.some((pattern) => pattern.test(label));
	});

	if (!control) return null;
	const label = control.label && control.label.text ? control.label.text : "";
	return {
		control,
		isFinalSubmit: FINAL_SUBMIT_PATTERNS.some((pattern) => pattern.test(label)),
	};
}

module.exports = {
	detectTerminalState,
};
