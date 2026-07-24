const REVIEW_TYPES = {
	CONSENT_AUTHORIZATION: "consent-authorization",
	CONFIRM_PROPOSED_VALUE: "confirm-proposed-value",
	MANUAL_VALUE_REQUIRED: "manual-value-required",
	OPTION_SELECTION: "option-selection",
	FILE_REQUIRED: "file-required",
	FINAL_REVIEW: "final-review",
};

const REVIEW_ALLOWED_ACTIONS = {
	[REVIEW_TYPES.CONSENT_AUTHORIZATION]: ["authorize", "decline", "stop"],
	[REVIEW_TYPES.CONFIRM_PROPOSED_VALUE]: ["confirm", "replace", "skip", "stop"],
	[REVIEW_TYPES.MANUAL_VALUE_REQUIRED]: ["provide-value", "skip", "stop"],
	[REVIEW_TYPES.OPTION_SELECTION]: ["select", "prefer-not-to-answer", "skip", "stop"],
	[REVIEW_TYPES.FILE_REQUIRED]: ["provide-file", "skip", "stop"],
	[REVIEW_TYPES.FINAL_REVIEW]: ["keep-open", "finish-without-submit", "stop"],
};

module.exports = {
	REVIEW_ALLOWED_ACTIONS,
	REVIEW_TYPES,
};
