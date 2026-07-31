const fs = require("node:fs/promises");
const path = require("node:path");

const TARGET_DIRECTORIES = ["benchmark", "benchmarks", "logs", "reports"];

async function main() {
	const workspaceRoot = path.resolve(process.cwd());

	for (const relativePath of TARGET_DIRECTORIES) {
		const targetPath = path.resolve(workspaceRoot, relativePath);
		assertDirectWorkspaceChild(workspaceRoot, targetPath);
		const entries = await fs.readdir(targetPath, { withFileTypes: true }).catch((error) => {
			if (error && error.code === "ENOENT") return [];
			throw error;
		});

		for (const entry of entries) {
			await fs.rm(path.join(targetPath, entry.name), { recursive: true, force: true });
		}

		await fs.mkdir(targetPath, { recursive: true });
		console.log(`Cleared ${relativePath}/ (${entries.length} top-level entries removed)`);
	}
}

function assertDirectWorkspaceChild(workspaceRoot, targetPath) {
	if (path.dirname(targetPath) !== workspaceRoot) {
		throw new Error(`Refusing to clean path outside direct workspace children: ${targetPath}`);
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}

module.exports = {
	TARGET_DIRECTORIES,
	assertDirectWorkspaceChild,
};
