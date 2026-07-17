const DEFAULT_LIMITS = {
	"action-verification-failed": 1,
	"dynamic-page-change": 1,
	"failed-click": 1,
	"stale-element": 2,
	"upload-failure": 1,
};

class RetryPolicy {
	constructor(options = {}) {
		this.limits = {
			...DEFAULT_LIMITS,
			...(options.limits || {}),
		};
		this.attempts = new Map();
	}

	canRetry(failure) {
		return this.getAttemptCount(failure) < this.getLimit(failure);
	}

	recordRetry(failure) {
		const key = failure.retryKey;
		const nextCount = this.getAttemptCount(failure) + 1;
		this.attempts.set(key, nextCount);
		return nextCount;
	}

	getAttemptCount(failure) {
		return this.attempts.get(failure.retryKey) || 0;
	}

	getLimit(failure) {
		return this.limits[failure.type] || 0;
	}
}

module.exports = {
	RetryPolicy,
};
