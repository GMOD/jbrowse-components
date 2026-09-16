---
name: grammar-layer-next-steps
description: What a 2026-09-15 read of GRAMMAR_OF_GRAPHICS.md against the tree found still buildable after the doc's own drift was fixed, less what ADR-123 closed on 2026-09-16 — a Score menu with no way to pin the axis to what is on screen, and the retired global autoscale, which nothing records. Read before proposing a grammar feature or attaching the mark display to another track type.
---

# The grammar layer: what is left to build

`reference/GRAMMAR_OF_GRAPHICS.md` reads the mark layer against the grammar's
seven stages and is the map to check before proposing anything here. A
2026-09-15 pass verified it against the tree; what follows is the part that
still needs code. **Delete this file when the last item lands or is filed
elsewhere.**

**Every remaining convergence in that doc is parked, and the parking is
deliberate** — the alignments renderer pair (needs a second display that stacks
sections), canvas's `packRenderArrays` (3.11x,
[ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md)),
the `startEnd` split (needs a consumer wanting two arrays, ADR-106
§Consequences), independent colour resolution and a main-thread re-packable
layout ([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)),
`window` and `sample` ([ADR-112](../architecture-decision-records/adr-112-a-layer-owns-its-transform-and-its-zoom-range.md)),
conditional encoding and `size`/`opacity`/`angle` as channels (ADR-095's
trade). Nothing below reopens one.

The fetch passing no zoom, and `QuantitativeTrack` behind it, landed as
[ADR-123](../architecture-decision-records/adr-123-a-mark-reads-a-bigwig-at-the-rungs-floor.md).
The two items left are independent.

## 1. The Score menu cannot pin the axis to what is on screen

`packages/wiggle-core/src/scoreMenuItems.ts` offers Scale type, Autoscale type,
"Set min/max score..." and, once something is pinned, "Clear manual min/max".
Nothing freezes the domain currently drawn, so holding a figure's axis still
across a pan means reading two numbers off the screen and typing them into a
dialog. Since `global`/`globalsd` autoscale is retired (item 2), that is the
only way there is.

**The obvious implementation is wrong**, and it is worth writing down because
the member names invite it. `minScoreBound`/`maxScoreBound` are not where the
axis resolved to on screen: `ScoreScaleMixin` defines them as
`manualMinScore ?? defaultScoreDomain[0]`, documented as "`undefined` means
autoscale this end". On an ordinary autoscaled wiggle with nothing pinned both
are `undefined`, so copying them into `setMinScore`/`setMaxScore` writes
nothing — the exact opposite of pinning. The pair to read is the display's
`get domain()` (`WiggleCommonMixin.ts`, and the mark display's own in
`plugins/marks/src/LinearMarkDisplay/model.ts`). Check that every
`ScoreScaleModel` implementer answers it under that name before adding it to
the interface: the wiggle pair and the mark display do; manhattan and the
coverage band were not checked.

Three more hazards, all real:

- A display overriding `defaultScoreDomain` resolves both ends to numbers with
  nothing configured — `plugins/gccontent/src/LinearGCContentDisplay/shared.tsx`
  does. The naive write pins `0..1`, flips `hasManualScoreBounds` and adds a
  "Clear manual min/max" row that changes nothing visible. That is the same
  trap `scoreMenuItems.ts` already documents for its caption.
- `setMinScore`/`setMaxScore` are `setConf` over `minScore`/`maxScore`, whose
  unset sentinels are `Number.MIN_VALUE`/`MAX_VALUE`. Real numbers are safe;
  `undefined` resets.
- The mark display overrides both onto `setDeclaredBound`, so there the write
  lands on `encoding.y.domain` rather than the score slots — which is right,
  and worth a test.

One menu item, reaching every wiggle-family display at once.

## 2. Nothing records that global autoscale was retired

`packages/wiggle-core/src/remapRetiredAutoscale.ts` maps `global` → `local` and
`globalsd` → `localsd`, `DEFAULT_AUTOSCALE_OPTIONS` lists only the three local
modes, and the wiggle and gwas config schemas install the remap. `agent-docs/`
has no record of the decision — no ADR, no reference doc, no mention anywhere.

The adapter surface survives the consumers:
`getRegionQuantitativeStats`/`getMultiRegionQuantitativeStats` are still on
`BaseFeatureDataAdapter`, overridden on `BigWigAdapter` and `MultiWiggleAdapter`
and tested, and `BigWigAdapter` says in a comment that they are unused in-tree
and kept because an external plugin can call them.

This matters to the grammar map, which is why it is here: the doc's seam
"a value in no loaded region has never been seen, so the domain still grows as
the user pans" is a true description of today, but a reader takes it as an
unfinished edge. The retirement does not close that seam — it makes it
permanent, and makes a pinned `domain` the answer rather than a workaround.
An ADR saying so is what the doc should be able to point at, and what would
stop the next reader proposing a global-stats round trip.
