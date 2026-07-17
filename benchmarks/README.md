# Benchmark Datasets

Benchmark datasets are JSON files that list target websites and input artifacts.

The benchmark framework must remain passive: cases may provide URLs, profiles, resumes, cover letters, tags, and generic runtime limits, but they must not provide selectors, workflow scripts, ATS names, or per-site optimization rules.

## Dataset Shape

```json
{
  "name": "real-world-job-applications",
  "version": "1",
  "cases": [
    {
      "id": "example-company-application",
      "name": "Example Company Application",
      "url": "https://example.com/jobs/apply",
      "profilePath": "../../data/profile-full-stack.json",
      "resumePath": "../../data/resume.pdf",
      "coverLetterPath": "../../data/cover-letter.pdf",
      "tags": ["job-application", "multi-step"],
      "options": {
        "maxCycles": 30
      }
    }
  ]
}
```

Use `npm run benchmark -- <dataset.json>` to produce a benchmark run under `logs/benchmarks/`.

Use `npm run compare-benchmarks -- <baseline-report.json> <candidate-report.json>` to compare two runs.
