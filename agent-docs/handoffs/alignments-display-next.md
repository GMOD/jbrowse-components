---
name: alignments-display-next
description: "What is left of the 2026-10-22 LinearAlignmentsDisplay review now that ADR-240's open calls 2 and 3 are closed: the quality fade as opacity (step 2b), the deprecated colorBy getter, and ggjbrowse's dog10k_lof page, blocked on its data host's expired certificate. The other ADR-240 steps are ordered in vega-lite-vocabulary.md."
---

# LinearAlignmentsDisplay: next steps

The display's end state is
[ADR-240](../architecture-decision-records/adr-240-the-alignments-display-speaks-vega-lite.md).
Its remaining steps (pass B's `coverage.encoding.y`, 3c's layer filters, the
height step's `pileup.mark.height`) are ordered in
[vega-lite-vocabulary.md](vega-lite-vocabulary.md); claim a step there before
starting it.

## ADR-240 work outside the vocabulary handoff

- **Step 2b, the quality fade as opacity:** `pileup.mismatches.encoding.opacity`
  over `baseQuality`; two uniforms and a subtract, checked by one run of the
  mismatch bench.
- **The deprecated `display.colorBy` getter** and its exported `ColorBy` /
  `ReadColorBy` types restate `colorField` for external plugins
  (`readColorByOf`); drop them at the next ABI break
  (`reference/PLUGIN_ABI_STABILITY.md`).

## Settled, not to re-open

- **A sized lane keeps its siblings' equal slice.** Fit mode refuses lane
  sizing (`canSizeGroupHeights`), so only fixed and grow see an override. The
  drag handle sizes one lane without touching the others
  (`GroupResizeHandles`); the cost is blank space under a stack whose lane was
  shrunk, while a truncated sibling keeps its slice and its expand button.

## ggjbrowse

- `dog10k_lof` is the one tutorial page not re-knit at the 2026-10-23 pin:
  its callset host, kiddlabshare.med.umich.edu, serves an expired TLS
  certificate, so the knit and ggjbrowse's Docs CI fail on it. Re-knit it with
  ggjbrowse's tutorials script, naming `dog10k_lof`, once the certificate
  is renewed.
