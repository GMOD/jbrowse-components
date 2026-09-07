---
name: a-detector-for-decisions-written-inline-in-a-vs-main
description: A detector for decisions written inline in a `vs_main` body.
area: tooling-tests-and-docs
---

# A detector for decisions written inline in a `vs_main` body.

The shader
lift inventory lists *functions*, so a decision with no name is invisible to
it — and two real exports (`rectSpanPx`, the chevron layout) came from exactly
there. A detector was still refused: every heuristic available ("this stage
body contains a pixel snap and a magic constant") is noisy enough that people
learn to ignore it, which is worse than no mechanism. The control is the habit
stated in SHADER_JS_CODEGEN.md — when a `vs_main` grows a decision, give it a
name, and the inventory can then see it. Reopen only with a materially better
idea than a keyword heuristic.
