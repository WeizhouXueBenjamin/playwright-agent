const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"be",
	"do",
	"for",
	"i",
	"is",
	"my",
	"of",
	"or",
	"the",
	"to",
	"your",
]);

function scoreTextMatch(left, right) {
	const leftText = normalizeText(left);
	const rightText = normalizeText(right);
	if (!leftText || !rightText) return 0;
	if (leftText === rightText) return 1;
	if (leftText.includes(rightText) || rightText.includes(leftText)) return 0.92;

	const leftTokens = tokenize(leftText);
	const rightTokens = tokenize(rightText);
	if (!leftTokens.length || !rightTokens.length) return 0;

	return diceCoefficient(leftTokens, rightTokens);
}

function tokenize(text) {
	return normalizeText(text)
		.split(" ")
		.filter((token) => token && !STOP_WORDS.has(token));
}

function normalizeText(text) {
	return String(text)
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function diceCoefficient(leftTokens, rightTokens) {
	const left = new Set(leftTokens);
	const right = new Set(rightTokens);
	let overlap = 0;

	for (const token of left) {
		if (right.has(token)) overlap += 1;
	}

	return (2 * overlap) / (left.size + right.size);
}

module.exports = {
	normalizeText,
	scoreTextMatch,
	tokenize,
};
