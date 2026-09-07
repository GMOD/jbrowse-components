---
name: a-gate-for-docstring-cross-references-that-no-longer-resolve
description: A gate for docstring cross-references that no longer resolve
area: tooling-tests-and-docs
---

# A gate for docstring cross-references that no longer resolve

measured
2026-08-21 and declined, at a hit rate of about one a month. It has a real
motivating case: `totalAlignmentBp` pointed at `alignmentCoverageFraction` for
a month after `4f1c8ebd97` deleted it, and the api-docs generator published the
dangling name to the website. Every documented member already has an anchor in
`website/docs/models`, so resolving backticked camelCase names against that set
looks like a twenty-line checker. It fires **806 times over 342 distinct
names**, and essentially all of them are correct: a docstring's neighbours are
`awaitSvgReady`, `computeLoadingTerm`, `installAutoFadeLatch`,
`syntenyPanBufferPx`, `baseLinearDisplayConfigSchema` — real symbols that are
simply not model members. The anchor set is the wrong resolution target and the
right one is every export in the monorepo, which is a ts-morph pass and an
allowlist for shader constants and file names, for one hit a month. **Reopen
only** with a resolver that already exists for another reason — the api-docs
generator gaining a symbol table, say — not as a checker of its own.
