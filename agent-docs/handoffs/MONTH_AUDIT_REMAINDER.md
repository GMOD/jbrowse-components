---
name: month-audit-remainder
description: What is left of the six-agent audit of the month's highest-churn subsystems, with each remaining finding's verification status. Read before picking one up — three of the original handoff's framings did not survive checking.
---

# The month's audit: what is left

The audit's implemented findings landed between `43797a07b9` and `a5aa075381`.
Git holds what they were. This file is only the remainder, and it should be
**deleted** once these are filed or fixed.

## Check the claim before building against it

Three of the original handoff's framings did not survive contact:

- **"assembly-name branding — TODO.md already has the design"** pointed at
  `### Brand the out-of-request refNames`, which is about **refNames**.
  `matePanelIndexes` appears nowhere in `agent-docs/`. The real defect was two
  sites comparing assembly names raw across namespaces; `isSameAssemblyName`
  and two call sites fixed it, and the type-level branding refactor the pointer
  implied was never needed.
- **"the LGV placer fix does not land cleanly"** was a duplicate, not a
  conflict — main had reached the same fix independently and more thoroughly.
- **"three remaining untracked autoruns"** is at most one. `plugins/arc` was
  already converted to `installGlobalFetchAutorun`; a stale storybook bundle
  under `products/*/node_modules/.cache` still shows the old shape and will
  mislead a grep.

So: locate the symbols a finding names before sizing the work.

## Remaining

### The polyprotein strand arrow sits at the centre of the whole stack

`glyphEmitters.ts:381` passes `height: layout.height` to `emitStrandArrow`, and
for `layoutMatureProteinRegion` that is `rowHeight * numRows`
(`matureProteinRegion.ts:113`) — every cleavage-product row at once. The arrow's
y is `topPx + height / 2` (`emitPrimitives.ts:222`), so on SARS-CoV-2 ORF1ab it
lands about eight rows below the CDS top. The transcript path two hundred lines
up passes `transcript.height`, one row.

**Verified**: the arrow is drawn at fixed pixel size (`STEM_LENGTH_PX`,
`HEAD_HALF_H_PX`), so `height` reaches only `snapBoxCenterYPx` and
`centeredRowVisible` — this is a position bug, not a size one, and the original
finding's wording ("the polyprotein strand-arrow y") was exact.

**Not verified**: that it is wrong. An arrow for the whole ORF centred on the
whole ORF block is defensible; the case against it is that it disagrees with the
transcript path. Get the visual call before editing. In `below` mode each product
also owns a label row, so the drawn stack is taller than `totalHeight` and the
midpoint is off by more than the arithmetic above suggests.

### `StatusReporter` should be a union, not an optional field

`createStopTokenRotation.ts:15`. When a host lends its `statusWindow` the
rotation writes through the window and never calls `setStatusMessage` — so the
interface requires a method that is dead in one of its two modes, and a caller
supplying one silently gets nothing. `lent` at line 151 is the discriminator
already, computed from the optional field.

Two shapes, one per mode. Every construction site has to answer, which is what
makes it worth doing at the type level rather than in a comment.

### The remaining untracked autorun, if there is one

The rule is CLAUDE.md's "an autorun must do its own reads", and the shape to
look for is an autorun whose body immediately awaits a helper taking `self`,
where the helper does the observable reads — tracked only because the call chain
stays synchronous to its first await.

`packages/synteny-core/src/detectSwappedAssemblies.ts:152` is the near miss:
it looks like the shape but takes `axisAssemblies` as a thunk and calls it in
the body, which is the intended pattern. What it does **not** establish is
whether `detectDisplayAssembliesSwapped` reads anything else synchronously;
nobody has checked.

`installGlobalFetchAutorun`'s `prepare` phase is the general answer for a
display — see `plugins/arc/src/shared/fetchArcFeatures.ts`, where `prepare`
holds the reads and the run phase gets plain arguments. A view-level autorun has
no such skeleton; `BreakpointSplitView/model.ts` reads its own blocks inline
instead, pinned by `fetchTracksBlocks.integration.test.ts`.

**Two things that test cost an hour and will cost the next one the same.**
`staticBlocks` is quantized, so a pan inside the current set is deliberately not
a refetch and a contig a screen holds whole never produces one — it takes a
10 Mb contig and a 5000px pan. And a plain array cannot be waited on with
`when`; make the call log observable or every wait times out looking exactly
like the missing fetch you are hunting.
