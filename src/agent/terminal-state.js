const FINAL_SUBMIT_PATTERNS = [
	/\bsubmit\b/i,
	/\bapply\b/i,
	/\bsend\b/i,
	/\bfinish\b/i,
	/\bconfirm\b/i,
];

function detectTerminalState(semanticPage, decision) {
	if (decision.type === "needs-review") {
		return {
			reached: true,
			status: "needs-review",
			reason: decision.reason,
			details: decision.details,
		};
	}

	if (decision.type === "none") {
		const finalControl = findFinalSubmitControl(semanticPage);
		if (finalControl) {
			return {
				reached: true,
				status: "awaiting-human-confirmation",
				reason: "final-submission-control-detected",
				details: { control: finalControl },
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

function findFinalSubmitControl(semanticPage) {
	return (semanticPage.interactiveElements || []).find((element) => {
		if (element.kind !== "button") return false;
		const label = element.label && element.label.text ? element.label.text : "";
		return FINAL_SUBMIT_PATTERNS.some((pattern) => pattern.test(label));
	});
}

module.exports = {
	detectTerminalState,
};
