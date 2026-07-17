Milestone 14 — End-to-End Benchmark Framework

Read .codex/instructions.md before making any changes.

Objective

Build a repeatable benchmarking framework for evaluating the Browser AI Agent on real-world job application websites.

The benchmark should allow future improvements to be measured objectively rather than subjectively.

Scope

Implement a benchmark runner capable of:

- running complete application workflows
- executing against multiple websites
- collecting execution statistics
- recording failures
- comparing benchmark runs
- generating benchmark reports

Each benchmark should produce:

- success or failure
- execution time
- action count
- retries
- recovery count
- validation errors
- unsupported components
- confidence metrics
- screenshots
- reasoning logs
- runtime state history

The benchmark framework should support adding new websites without changing the evaluation architecture.

Constraints

Do not introduce website-specific optimizations into the benchmark framework.

The framework should evaluate the agent, not influence its behavior.

Deliverables

- Benchmark Runner
- Benchmark Report Generator
- Benchmark Dataset Structure
- Benchmark Comparison Tool
- Historical Benchmark Results
