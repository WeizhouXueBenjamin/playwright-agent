const { spawn } = require("node:child_process");

class DisabledSemanticDecisionProvider {
	async produceSemanticDecision() {
		return {
			status: "disabled",
			decision: null,
		};
	}
}

class CodexCliSemanticDecisionProvider {
	constructor(options = {}) {
		this.command = options.command || "codex";
		this.timeoutMs = options.timeoutMs || 30000;
		this.cwd = options.cwd || process.cwd();
	}

	async produceSemanticDecision({ decisionContext } = {}) {
		const input = buildSemanticPromptInput(decisionContext || {});
		const result = await runCodexExec({
			command: this.command,
			cwd: this.cwd,
			timeoutMs: this.timeoutMs,
			stdin: JSON.stringify(input, null, 2),
		});

		if (result.status !== "ok") {
			return {
				status: "needs-review",
				decision: null,
				reason: result.reason,
			};
		}

		const parsed = parseJsonObject(result.stdout);
		if (!parsed || !isValidSemanticDecision(parsed, input)) {
			return {
				status: "needs-review",
				decision: null,
				reason: "codex-semantic-output-invalid",
			};
		}

		return {
			status: "codex-semantic",
			decision: {
				...parsed,
				source: parsed.source,
				resolutionMethod: "codex-semantic",
			},
		};
	}
}

class FixtureSemanticDecisionProvider {
	constructor(fixtures = {}) {
		this.fixtures = fixtures;
	}

	async produceSemanticDecision({ decisionContext } = {}) {
		const key = decisionContext && decisionContext.fixtureId || "";
		return {
			status: key && this.fixtures[key] ? "fixture-decision" : "no-fixture",
			decision: key && this.fixtures[key] ? structuredClone(this.fixtures[key]) : null,
		};
	}
}

class ShadowSemanticDecisionProvider {
	constructor(provider = new DisabledSemanticDecisionProvider()) {
		this.provider = provider;
	}

	async produceSemanticDecision(input = {}) {
		const result = await this.provider.produceSemanticDecision(input);
		return {
			...result,
			shadowOnly: true,
			executable: false,
		};
	}
}

function buildSemanticPromptInput(decisionContext) {
	return {
		instructions: [
			"Return only one JSON object.",
			"Choose an action proposal for the single observed field using only supplied candidate facts.",
			"Do not invent facts. If uncertain, return {\"action\":\"ask-user\",\"requiresReview\":true}.",
		],
		field: decisionContext.field || {},
		candidateFacts: decisionContext.candidateFacts || [],
	};
}

function runCodexExec({ command, cwd, timeoutMs, stdin }) {
	return new Promise((resolve) => {
		const child = spawn(command, ["exec", "--ephemeral", "--sandbox", "read-only", "-"], {
			cwd,
			windowsHide: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		const timeout = setTimeout(() => {
			child.kill();
			resolve({ status: "failed", reason: "codex-semantic-timeout", stdout, stderr });
		}, timeoutMs);

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", (error) => {
			clearTimeout(timeout);
			resolve({ status: "failed", reason: error.message, stdout, stderr });
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			resolve(code === 0
				? { status: "ok", stdout, stderr }
				: { status: "failed", reason: `codex-semantic-exit-${code}`, stdout, stderr });
		});
		child.stdin.end(stdin);
	});
}

function parseJsonObject(output) {
	const text = String(output || "").trim();
	try {
		return JSON.parse(text);
	} catch {
		const match = text.match(/\{[\s\S]*\}/);
		if (!match) return null;
		try {
			return JSON.parse(match[0]);
		} catch {
			return null;
		}
	}
}

function isValidSemanticDecision(decision, input) {
	if (!decision || typeof decision !== "object") return false;
	if (!["fill", "select", "check", "upload", "ask-user"].includes(decision.action)) return false;
	if (decision.action === "ask-user") return decision.requiresReview === true;
	if (decision.fieldRef !== input.field.ref) return false;
	const fact = (input.candidateFacts || []).find((candidate) => candidate.path === decision.source);
	if (!fact) return false;
	if (decision.action === "select") {
		return (input.field.options || []).some((option) => option === decision.value);
	}
	return Object.prototype.hasOwnProperty.call(decision, "value");
}

module.exports = {
	CodexCliSemanticDecisionProvider,
	DisabledSemanticDecisionProvider,
	FixtureSemanticDecisionProvider,
	ShadowSemanticDecisionProvider,
};
