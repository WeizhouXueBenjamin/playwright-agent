# Real Website Validation Specification (RWVS)

Read .codex/instructions.md before making any changes.

## Objective

Validate, benchmark, debug, and continuously improve the Browser AI Agent using real-world job application websites.

Always improve the agent's general capabilities.

Never optimize specifically for one ATS unless there is clear evidence that the issue cannot be solved generically.

Every change must be validated by benchmark comparison.

---

# Validation Pipeline

Execute the following phases in order.

Do not skip phases.

Do not continue until the previous phase succeeds.

1. Observation

Collect:

- DOM Snapshot
- Accessibility Tree
- Screenshot
- Runtime State
- Page Understanding
- Reasoning Log
- Console Logs
- Network Errors

No browser interaction.

Output:

Observation Report

---

1. Component Validation

Validate detection of:

- fields
- buttons
- uploads
- dropdowns
- checkboxes
- radio buttons
- required fields
- validation messages

Generate:

- Coverage
- Unsupported Components
- Confidence
- Risk Assessment

No browser interaction.

Output:

Validation Report

---

1. Partial Execution

Allow:

- typing
- uploads
- navigation
- recovery
- retries

Execution loop:

Observe
→ Reason
→ Execute
→ Verify
→ Update Runtime State

Stop before:

- final submission
- payment
- account creation
- irreversible confirmation

Output:

Execution Report

---

1. Failure Analysis

Classify every failure:

- Observation
- Detection
- Reasoning
- Planning
- Execution
- Verification
- Recovery

For each failure provide:

- root cause
- impact
- suggested improvement

Output:

Failure Report

---

1. Improvement

Improve only generic Browser AI Agent capabilities.

Prefer:

- observation
- reasoning
- planning
- execution
- recovery
- verification

Avoid:

- website-specific selectors
- hardcoded workflows
- platform-specific logic

Output:

Improvement Summary

---

1. Benchmark

Re-run the complete benchmark.

Compare with historical runs.

Generate:

- Success Rate
- Coverage
- Execution Time
- Retry Count
- Recovery Count
- Verification Failures
- Regression Analysis

Output:

Benchmark Report

---

# Required Artifacts

benchmark/

    <website>/

        observation/

        validation/

        execution/

        reports/

        history/

Store:

- screenshots
- DOM snapshots
- accessibility trees
- runtime states
- reasoning logs
- action logs

---

# Required Markdown Report

Generate benchmark.md after every run.

Include:

# Summary

- Website
- Run ID
- Date
- Result
- Success Rate
- Coverage
- Execution Time
- Retries
- Recovery
- Verification Failures
- Stopped Before Submit

# Component Coverage

Markdown table.

# Failure Summary

Markdown table.

# Suggested Improvements

Markdown table.

# Historical Comparison

Markdown table.

---

# Required Improvement Backlog

Generate backlog.md after every run.

Prioritize improvements.

Columns:

Priority

Area

Issue

Suggested Fix

Estimated Impact

Status

---

# Regression Gate

Compare against the previous benchmark.

If any of the following regress:

- Success Rate
- Coverage
- Verification Failures
- Runtime Errors

Mark the run as:

REGRESSION

Do not consider the implementation complete.

Explain the regression.

---

# Rules

The Runtime State contains only verified facts.

Every action must be verified before updating the Runtime State.

Never optimize specifically for one ATS.

If website-specific logic is required, explain why the issue cannot be solved generically.

No issue is considered fixed until the benchmark confirms improvement.
