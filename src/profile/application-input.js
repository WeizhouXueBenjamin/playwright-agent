function buildApplicationProfile(input) {
	return {
		...(input.profile || {}),
		resumePath: input.resume || input.resumePath || input.profile && input.profile.resumePath || "",
		coverLetterPath: input.coverLetter || input.coverLetterPath || input.profile && input.profile.coverLetterPath || "",
	};
}

module.exports = {
	buildApplicationProfile,
};
