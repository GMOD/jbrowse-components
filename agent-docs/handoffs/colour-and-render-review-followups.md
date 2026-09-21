---
name: colour-and-render-review-followups
description: What a 2026-09-21 review of the overnight colour-object, shader-loading and multiway landings found and did not fix, the synteny mate and follow findings excepted (those are synteny-mates-and-follow-review). Its calls are all decided; one measurement remains, each deciding whether anything is built. Read before touching the colour objects' menus, the mark rule list, the shader loaders or the multiway demos.
---

# Colour, shader-loading and multiway follow-ups

The review read the overnight changes to `agent-docs/` and checked each claim
against the code. What it fixed has landed. What follows is the rest: file each
item into [ideas/](../ideas/README.md) or [TODO.md](../TODO.md) once someone
decides it, and delete this file when none is left.

## Waiting on a number

- **Whether every alignments figure paints as it did under ADR-149.** The
  per-base layer split its own `baseColor` object off `color`, and no suite
  checks the claim that a modification layer over the plain fill draws the old
  picture. Capture the methylation and bisulfite figures
  (`test_data/arabidopsis_methylation`, `test_data/methylation_test`) against
  their goldens.
