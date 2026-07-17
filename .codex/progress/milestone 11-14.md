# Roadmap (Milestones 11–14)

The next phase shifts the focus from building the Browser AI Agent to validating, benchmarking, and continuously improving it in real-world environments.

Rather than introducing new autonomous capabilities, these milestones establish an engineering workflow for evaluating reliability, identifying weaknesses, and measuring progress objectively across different job application platforms.

| Milestone | New Capability                         | What It Adds Beyond Milestone 10                                                                                                                                                                                                      |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **11**    | **Observation & Benchmark Collection** | Introduces a non-invasive Observation Mode that collects browser snapshots, DOM structure, accessibility data, runtime state, screenshots, and reasoning logs from real job application websites without performing any interactions. |
| **12**    | **Component Validation**               | Verifies the agent's understanding of real-world pages by evaluating field detection, semantic mapping, upload components, navigation controls, validation messages, and unsupported UI elements before execution.                    |
| **13**    | **Partial Execution Validation**       | Safely validates execution capabilities on live websites by completing form filling, uploads, navigation, and recovery while always stopping before irreversible actions such as final submission or account creation.                |
| **14**    | **End-to-End Benchmark Framework**     | Establishes a repeatable benchmarking framework that evaluates the Browser AI Agent across multiple websites, tracks performance over time, compares benchmark runs, and generates structured reports for continuous improvement.     |

After Milestone 14, development evolves from feature implementation into a continuous evaluation workflow:

```text
Real Job Website
        ↓
Observation
        ↓
Component Validation
        ↓
Partial Execution
        ↓
Benchmark Evaluation
        ↓
Performance Report
        ↓
Identify Weaknesses
        ↓
Improve Agent
        ↓
Repeat
```

At this stage, the project transitions from building a **goal-driven Browser AI Agent** into maintaining a **continuously evaluated and benchmarked autonomous system**.

Every future improvement—whether adding support for new ATS platforms, enhancing reasoning, improving recovery strategies, or integrating vision models—can be measured objectively against the same benchmark suite. This ensures that development is driven by reproducible metrics rather than subjective observations, enabling reliable long-term evolution of the agent.
