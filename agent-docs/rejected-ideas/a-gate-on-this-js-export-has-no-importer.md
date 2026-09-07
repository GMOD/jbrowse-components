---
name: a-gate-on-this-js-export-has-no-importer
description: A gate on "this `//! js-export` has no importer"
area: tooling-tests-and-docs
---

# A gate on "this `//! js-export` has no importer"

designed and abandoned.
Every row it would raise resolves to "leave it" (see the table in
[SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md)), and it would not catch the
accretion ADR-051 fears anyway: a new marginal export always has a consumer,
that being why someone added it. It stays a line in a report.
