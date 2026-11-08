---
name: alignments-analysis-2026-11
description: "What remains of the 2026-11-07 plugins/alignments analysis after its chain-mode right-click fix and dead-code pass landed on 2026-11-08: two small bugs, a CRAM bench, the read-field registry and the guide-from-scale convergences (tag colors first), each with what waits on Colin. Read before a cleanup or grammar pass on the alignments display."
---

# Alignments analysis, 2026-11-07

- **In:** four read-only reviews of `plugins/alignments` (main-thread model,
  worker and compute, cross-display sharing, grammar expressivity), then a
  critical pass checking each claim against the code and the ADRs. The
  chain-mode right-click fix and the verified dead code landed on
  2026-11-08.
- **Out:** the steps below landed, filed to `ideas/`, or declined with a
  sentence at the site.

Shares its convergence pattern with
[wiggle-grammar-and-cleanup](wiggle-grammar-and-cleanup.md): a key built by
hand where core has one. Claim a step here before starting it. "Verified"
means read in the code on 2026-11-07; re-read against main first.

## Not covered

`RenderAlignmentDataRPC/sortLayout.ts`, most of `tables.ts`,
`features/arcs/compute.ts` past read grouping, the shaders, the Htsget
adapter, and `packages/alignments-core` beyond what callers touch. A
review of those starts cold.

## Bugs (small, none on a default path)

- **`readLayoutRecord` boxes reads the display does not draw.** Verified.
  `LinearAlignmentsDisplay/model.ts` `readLayoutRecord` never checks the
  section draws a pileup, so the BreakpointSplitView overlay
  (`plugins/breakpoint-split-view/src/BreakpointSplitView/readChains.ts`)
  curves to a 0 px band under Show → Pileup off or a chip-collapsed lane.
  Return `undefined` when the section's rows height is 0, and add the
  overlay test. Not seen on screen yet: drive it once before and after.
  - Bigger version, measure first: lay every lane out coverage-only while
    `!showPileup`, as collapsed lanes are (`pileupLayoutViews.ts`
    `groupLayoutContext`), which also skips the bake and connector passes.
    Costs one relayout on re-show.
- **`nonReferenceAt` counts hidden lanes.** Verified that it walks every
  group. ADR-259's Save track data writes "the counted reads of the visible
  lanes", so skip `hiddenGroups`. The only reader is jbrowse-img `sortAt`;
  lowest priority.
- Declined: `clearHoveredFeature` ignoring the pin (no trigger found);
  `setUnit` replacing a solid color (reversible, intent unclear; ask before
  touching); the height-mode word "Fixed" against display-kit's "Scroll"
  (they name different things: "Fixed" is ticked under `fit` too, and a
  fitted track does not scroll, `f0df3b34c0`); a read-mode connector's
  right-click lighting one end where its hover lit both (the pin lights the
  read the menu acts on, as chain mode lights the chain).

## CRAM parity (needs a bench)

- `CramSlightlyLazyFeature` has no `hasEndClip`, so `saTagOf`
  (`shared/splitAlignment.ts`) walks every CRAM read's tags; BAM's gate
  measured 27 ms → 4 ms. Add the getter from the leading and trailing clip
  lengths and bench on ada before claiming a win. `getTagAlt` (MM/Mm, XS/TS
  in one pass) is the same shape, lower value.

## Grammar: one read-field registry (Colin's call, then a review)

The field vocabulary is restated per role: `COLOR_FIELDS`, `READ_DIMENSIONS`,
`COLUMN_SORT_FIELDS`, and the filter's `isAdapterField` / `isDrawnField` /
`isReadField` (`shared/filterFields.ts` says so on purpose).
`readFieldLevels.ts` already shares the levels. A registry entry per field
(name, measurement type, levels, per-read reader, the tier that computes it)
would let each role accept a field by type and derive `filterProblems`,
`sortProblems` and the More filters rows.

What it makes sayable, verified as unsayable today:

- `filter` on `pairOrientation`, `pairing`, `svKind`, `mateRefName`,
  `firstOfPairStrand` (facet and color take them). Real asks: mate on chr9,
  only inversion evidence, stranded RNA-seq.
- `sort` by any field for the whole window (`tags.HP`, `mapq`), with
  `order`. Today a tag without `pos` keeps position order with a
  `sortProblems` warning, so it is not silent, as one review claimed.
- `insertSize` as a quantitative field (sort, `gte`, ramp), since no role can
  name TLEN after ADR-240 retired its color field.
- `scale.type: 'log'` for quantitative fields (`ALIGNMENTS_COLOR_SCALES` is
  ordinal, linear, threshold).

The registry is a table whose columns are roles, not one flat list every
role accepts: `COLOR_FIELD_DEFS` carries a shader path and a menu slot, and a
column sort needs a per-position reader.

Open before any code:

- **Tier collision.** ADR-259 puts read categories at the drawn tier
  (coverage whole) and flags at the counted tier (coverage thinned). A
  drawn `strand` filter would sit beside the counted `flags.REVERSE`: one
  question, two spellings, two coverage reaches. Recommended ruling (a
  2026-11-08 review): ADR-259 draws the line by what is asked, so categories
  (`pairOrientation`, `pairing`, `svKind`, `mateRefName`,
  `firstOfPairStrand`) filter at the drawn tier beside `svSignal`, record
  quality (flags, tags, mapq) counts, and `strand`, which is flag 0x10, is
  refused as a filter field with `filterProblems` naming `flags.REVERSE`.
  Decide this first.
- **Speed.** Each role compiles to a per-field kernel once per fetch, reusing
  the facet's `keyAll`; no reader call per read per role. Bench
  `drawnReadFilter.bench.ts` with a facet-field entry against today.
- **Closed neighbors:** ADR-229 rejected `pairing` as the SV-evidence filter
  (a plain `pairing` entry differs; get a ruling). ADR-240 keeps
  `facet.hidden` off the predicate list, and the registry does not need it
  there.
- Process: a draft of the end state, then an adversarial review of the whole
  surface (memory `alignments-vocabulary-is-grammar-of-graphics`). Writers to
  update are in ADR-240's Order of work.
- First step, not an interim: `shared/readFields.ts` holding the table, the
  four lists derived from it (a missing role is a compile error), and
  `filterProblems`/`sortProblems` reading it. New filter fields land after,
  through the facet's `keyAll` kernel, benched on ada.

Smaller grammar items, each independent:

- `ALIGNMENTS_PLOT_EXAMPLES` (`plotExamples.ts`) has no methylation, RNA-seq
  or SV channels example. The cheapest win here.
- Sashimi width is hard-wired (`features/sashimi/bandFeed.ts`
  `sashimiStrokeWidth`) where `readConnections` writes `encoding.strokeWidth`.
  The 1 px floor is a hit-target floor and stays under any written scale.
  Taste.
- `svKind` is colorless by inheritance from ADR-230's "reads keep their
  arcs' colors" (`COLORLESS_FIELDS`); ADR-258 since made a read's band agree
  with its arc. Put it to Colin, don't build it.
- A column facet (`{ field: 'base', pos, refName }`) for allele-specific
  expression without HP tags. A proposal, unverified whether the facet key
  can read the sort column's base without a second CIGAR walk; goes to
  `ideas/` if not taken up.

## Convergences: a guide comes from its scale (ADR-108/109)

- **Tag-value colors and their key.** Re-verified 2026-11-08:
  `tagValueColor` (`LinearAlignmentsDisplay/colorTagUtils.ts`) hashes strings
  into 30 slots (7 values collide about 53% of the time) and wraps integers
  mod 10 (NM 0 = NM 10), and the key is built by hand (`shared/legendUtils.ts`
  `bakedValueLegend`). ADR-205 records "alignments tag colors keep their own
  hash copy" as a consequence, with no Rejected row. The deal answers the
  reproducibility reason `colorTagUtils.ts` gives for hashing, though not by
  storage: held slots are in memory (`heldSlotsOf`, never persisted; ADR-205
  rejected session state). A value nothing collides with paints its hashed
  color everywhere, and each region deals in `field.compare` order, so a
  reload at the same locus reproduces; elsewhere only a collided pair can
  swap, which today would be one color.
  - HP:1 stays the leading blue through a `slotOf` preference option on
    `categoricalScale` (default the hash), which alignments passes its integer
    rule; core learns no SAM tag.
  - Per-read cost is unchanged: `makeColorResolver` already caches one pack per
    distinct value. The deal runs per region before `buildReadFillColors`.
  - `bakedColorScale`'s declared-domain branch already routes through
    `categoricalColorScale`, without `held`.
  - Goldens recolor where pairs collided. A bench on a 10k-value tag
    (`tags.RG` on a merged cohort) would show whether the deal's per-value
    work is visible. 2–3 days. Recommended next; Colin's call.
- **The tables key.** `tables.ts` builds its legend by hand from
  `legendItems` where every other display calls `colorKeyTables`;
  `977b8d5d1f` and `9caaafd09c` each fixed both keys. Independent of the tag
  step: `colorKeyTables(colorScalesIn(theme))`, about a day, best in the same
  pass. Reaches the R reader.
- **Group by dialogs.** Alignments' and features' each own scan, verdict and
  color rule; "a hand-picked color stays" landed on features 2026-10-18 and on
  alignments 2026-10-26 (`33371390fb`). A display-kit shell with the scan and
  verdict passed in. About a day. Independent of the registry.
- **Coverage log ticks.** Power-of-2 against wiggle's power-of-10 since
  `85732820a4` touched wiggle-core only. ADR-109 lets the band keep its own
  ladder, and log-scale coverage is rare: leave it.

## Declined in the critical pass

- Sashimi counts and consensus including reads a drawn filter hides:
  ADR-259 decides it.
- Sharing arcs' and linked reads' read grouping: measured back out, said at
  both sites.
- `model.ts` split into sibling views modules for size alone: do it only
  alongside a change in that section.
