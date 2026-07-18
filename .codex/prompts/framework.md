# Browser AI Agent Architecture Migration

## Context

This project is no longer an experimental Playwright automation.

Its long-term objective is to become a production-quality Browser AI Agent Framework that can operate across multiple ATS platforms (QJumpers, Greenhouse, Lever, Workday, SmartRecruiters, etc.) without relying on platform-specific logic.

The project already contains a working implementation.

Do NOT redesign it from scratch.

Do NOT perform a large-scale rewrite.

Instead, evolve the current architecture through small, incremental, benchmark-safe improvements.

Preserve existing behaviour whenever possible.

---

# Philosophy

The architecture should evolve around **stable contracts**, not around implementations.

Implementations may change over time.

Contracts should remain stable.

The system should optimize for:

- Generalization
- Explainability
- Verifiability
- Extensibility
- Maintainability
- Benchmark-driven evolution

Avoid premature abstraction.

Avoid introducing complexity that is not yet justified by real benchmark data.

---

# Guiding Principles

Treat the Browser AI Agent as a decision-making system rather than an automation script.

The architecture should revolve around:

Goal

↓

Observation

↓

Verified Runtime State

↓

Decision

↓

Policy

↓

Planning

↓

Capability

↓

Execution

↓

Verification

↓

Runtime State Update

Every execution cycle should produce one verified decision.

---

# Architectural Principles

The following concepts should become long-term stable contracts.

## Observation Contract

Observation represents normalized browser perception.

It should become the common interface for:

- DOM
- Accessibility Tree
- Screenshot
- Vision
- OCR
- Console
- Network diagnostics

Observation is input only.

It should never contain reasoning.

---

## Runtime State Contract

Runtime State is NOT working memory.

Runtime State is the Verified Fact Store.

It must contain only facts verified through observation or successful execution.

Never store:

- assumptions
- reasoning
- confidence
- speculation

All Runtime State writes should occur through verified patch builders only.

---

## Decision Contract

Every loop should produce one Decision object.

A Decision should describe:

- current goal
- supporting evidence
- reasoning summary
- chosen action
- rejected alternatives
- risk assessment
- policy evaluation
- verification strategy

Treat Decision as a first-class artifact.

It should be benchmarkable.

---

## Verification Contract

Verification should become an independent subsystem.

Verification may use:

- DOM
- Runtime State
- Screenshot
- Vision
- Accessibility Tree
- Network
- Console

Verification should never be tightly coupled to execution.

---

## Capability Contract

Planner should never know implementation details.

Planner should express intent.

Capability implementations should determine how that intent is executed.

Capabilities should eventually support:

- text input
- uploads
- dropdowns
- date pickers
- autocomplete
- rich text
- iframe
- canvas
- future interaction types

Do not over-engineer this today.

Create lightweight interfaces only.

---

## Policy Contract

Safety policies should not be scattered throughout the codebase.

Introduce a lightweight Policy Engine.

Examples include:

- stop before final submission
- require confirmation for account creation
- block payments
- prevent destructive actions
- verify uploads before continuing

---

# Memory Model

Separate memory into three conceptual layers.

## Runtime State

Verified facts only.

## Session Memory

Temporary task context.

Examples:

- failed attempts
- navigation history
- temporary strategies
- retry history

Session Memory may assist reasoning.

It must never pollute Runtime State.

## Long-term Memory

Do NOT implement now.

Only introduce after sufficient benchmark data exists.

---

# Evolution Strategy

Prioritize contracts before implementations.

The recommended order is:

1. Define contracts.
2. Introduce lightweight interfaces.
3. Move responsibilities gradually.
4. Benchmark after every architectural change.
5. Continue only if no regressions are introduced.

Avoid large refactors.

Avoid changing working behaviour without measurable benefit.

---

# Migration Priorities

## Phase 1

Stabilize contracts.

Introduce or formalize:

- Observation
- Runtime State
- Decision
- VerificationResult
- BenchmarkReport

Do not significantly change behaviour.

---

## Phase 2

Clarify architectural boundaries.

Gradually separate:

- Observation
- Reasoning
- Decision
- Planning
- Execution
- Verification
- Recovery

Move code only when responsibility becomes clearer.

Avoid unnecessary file movement.

---

## Phase 3

Introduce lightweight Policy Engine.

Move safety rules into policies.

Keep behaviour unchanged.

---

## Phase 4

Introduce lightweight Capability interfaces.

Do not build a plugin framework yet.

Simply remove implementation assumptions from planning.

---

## Phase 5

Improve validation architecture.

Align:

- RWVS
- Benchmark
- Reports
- Regression
- Health Score

Every architectural improvement must be benchmark verified.

---

# Future Concepts

The following concepts are intentionally deferred.

Do NOT implement unless there is a demonstrated need.

- Long-term Memory
- Knowledge Base
- Multi-Agent Runtime
- Plugin Marketplace
- Learned Strategies
- Autonomous Self-Improvement
- Complex Goal Hierarchies

Design today's architecture so they can be introduced later without major rewrites.

---

# Expectations

Throughout this migration:

- preserve existing functionality
- preserve benchmark compatibility
- preserve platform independence
- avoid ATS-specific logic
- avoid speculative abstractions

Whenever multiple architectural options exist:

Prefer the smallest change that improves long-term maintainability.

If an abstraction is not yet justified by current functionality or benchmark evidence,

do not introduce it.

Always explain architectural decisions before implementing them.

Treat this migration as an evolutionary refinement of a working Browser AI Agent rather than a rewrite.
