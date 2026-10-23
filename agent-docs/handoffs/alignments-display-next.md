---
name: alignments-display-next
description: "What is left of the 2026-10-22 LinearAlignmentsDisplay review now that ADR-240's open calls 2 and 3 are closed: the quality fade as opacity (step 2b), the internal ColorBy scheme object, a connector's right-click (waits on the SA-hops gesture call), a 5hmC fill edge case under mixed MM skip flags, and ggjbrowse's stale published pages. The other ADR-240 steps are ordered in vega-lite-vocabulary.md."
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
- **The internal `ColorBy` scheme object** (`shared/types.ts`,
  `shared/alignmentsColor.ts` `colorByOf` / `colorFieldOf`) restates
  `color.field` in v4's scheme names, and the RPC arguments are still
  `filterBy` and `colorBy`. One field classifier serving color, facet, sort and
  predicates removes the translation. It changes no config path.

## A connector's right-click

Right-clicking a pileup connector opens the browser's menu
(`contextMenuTargetForHit`). Colin's call, and it waits on the gesture the
SA-hops idea needs (`ideas/waiting-on-a-call/sa-hops-in-the-bezier-overlay.md`):
giving the right-click to the nearer read's menu uses it up.

- Within `ARC_HIT_SLOP_PX` of a connector crossing a read, the connector
  outranks the read (`useAlignmentsBase.ts`), so that read's own menu is
  unreachable there.
- `ContextMenuHit` requires a block and `ConnectorMarkHit` has none; under the
  gap a cross-region connector spans, `runHitTest` finds no fetched block
  either. `hitTestPipeline.test.ts` pins "no menu".

## Settled, not to re-open

- **A sized lane keeps its siblings' equal slice.** Fit mode refuses lane
  sizing (`canSizeGroupHeights`), so only fixed and grow see an override. The
  drag handle sizes one lane without touching the others
  (`GroupResizeHandles`); the cost is blank space under a stack whose lane was
  shrunk, while a truncated sibling keeps its slice and its expand button.

## Edge case

- **`C+m.;C+h?` fills unlisted cytosines as unmodified.** `getMethBins` checks
  only the `m` groups' skip flag, so a site whose 5hmC status the tag calls
  unknown still paints the two-color view's blue. Untested, and no file in
  `test_data/` mixes the flags.

## ggjbrowse

- Its published tutorial pages still show `showSoftClipping` and
  `mark = "cloud"` until they are re-knit at a new `tutorials/JBROWSE_COMPONENTS`
  pin (memory `a-config-rename-reaches-ggjbrowse`). `pileup.connectors` joins
  them.
