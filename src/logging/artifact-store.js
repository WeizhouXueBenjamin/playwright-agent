const fs = require("node:fs/promises");
const path = require("node:path");

async function createRunLogDir(baseDir = "logs", date = new Date()) {
	const runId = formatRunId(date);
	const runDir = path.join(resolveBaseDir(baseDir), runId);
	await fs.mkdir(runDir, { recursive: true });
	return { runId, runDir };
}

async function writeTextArtifact(runDir, filename, content) {
	const artifactPath = path.join(runDir, filename);
	await fs.writeFile(artifactPath, content, "utf8");
	return artifactPath;
}

async function writeJsonArtifact(runDir, filename, content) {
	return writeTextArtifact(runDir, filename, `${JSON.stringify(content, null, 2)}\n`);
}

function formatRunId(date) {
	return `run-${date.toISOString().replace(/[:.]/g, "-")}`;
}

function resolveBaseDir(baseDir) {
	if (path.isAbsolute(baseDir)) return baseDir;
	return path.join(process.cwd(), baseDir);
}

module.exports = {
	createRunLogDir,
	writeJsonArtifact,
	writeTextArtifact,
};
