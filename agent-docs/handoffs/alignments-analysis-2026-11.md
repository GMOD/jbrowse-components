---
name: alignments-analysis-2026-11
description: "What remains of the 2026-11-07 plugins/alignments analysis: two small bugs, the read-field registry and the guide-from-scale convergences, each with what waits on Colin. Read before a cleanup or grammar pass on the alignments display."
---

# Alignments analysis, 2026-11-07

- **In:** four read-only reviews of `plugins/alignments` (main-thread model,
  worker and compute, cross-display sharing, grammar expressivity), then a
  critical pass checking each claim against the code and the ADRs. The
  chain-mode right-click fix and the verified dead code landed on
  2026-11-08.
- **Out:** the steps below landed, filed to `ideas/`, or declined with a
  sentence at the site.

Its convergence pattern is a key built by hand where core has one. Claim a step here before starting it. "Verified"
means read in the code on 2026-11-07; re-read against main first.

## Not covered

`RenderAlignmentDataRPC/sortLayout.ts`, most of `tables.ts`,
`features/arcs/compute.ts` past read grouping, the shaders, the Htsget
adapter, and `packages/alignments-core` beyond what callers touch. A
review of those starts cold.

## Bugs

- Declined: `clearHoveredFeature` ignoring the pin (no trigger found);
  `setUnit` replacing a solid color (reversible, intent unclear; ask before
  touching); the height-mode word "Fixed" against display-kit's "Scroll"
  (they name different things: "Fixed" is ticked under `fit` too, and a
  fitted track does not scroll, `f0df3b34c0`); a read-mode connector's
  right-click lighting one end where its hover lit both (the pin lights the
  read the menu acts on, as chain mode lights the chain).
- Open, measure first: lay every lane out coverage-only while `!showPileup`,
  as collapsed lanes are (`pileupLayoutViews.ts` `groupLayoutContext`), which
  would skip the bake and connector passes for reads nothing draws. Costs one
  relayout on re-show. The overlay no longer needs it: `readLayoutRecord`
  gives a 0-row lane's reads no rect.

## Grammar: one read-field registry (Colin's call, then a review)

The field vocabulary is restated per role: `COLOR_FIELDS`, `READ_DIMENSIONS`,
`COLUMN_SORT_FIELDS`, and the filter's `isAdapterField` / `isDrawnField` /
`isReadField` (`shared/filterFields.ts` says so on purpose). The filter's read
dimensions are derived: `READ_DIMENSIONS` and each closed dimension's levels
(`DIMENSION_LEVELS`) live in the import-free `readFieldLevels.ts`, which
`jbrowse validate` carries, and `DIMENSION_FIELDS` is `READ_DIMENSIONS` less
the fields the filter reads its own way (ADR-259's 2026-11-08 amendment). A
registry entry per field (name, measurement type, levels, per-read reader,
the tier that computes it) would let the other roles accept a field by type
and derive `sortProblems` and the More filters rows.

What it makes sayable, verified as unsayable today:

- `sort` by any field for the whole window (`tags.HP`, `mapq`), with
  `order`. Today a tag without `pos` keeps position order with a
  `sortProblems` warning, so it is not silent, as one review claimed.
- `insertSize` as a quantitative field (sort, `gte`, ramp), since no role can
  name TLEN after ADR-240 retired its color field.
- `scale.type: 'log'` for quantitative fields (`ALIGNMENTS_COLOR_SCALES` is
  ordinal, linear, threshold).

The registry is a table whose columns are roles, not one flat list every
role accepts: `COLOR_FIELD_DEFS` carries a shader path and a menu slot, and a
column sort needs a per-position reader. `readFieldLevels.ts` is where its
import-free columns would go.

Open before any code:

- Process: a draft of the end state, then an adversarial review of the whole
  surface (memory `alignments-vocabulary-is-grammar-of-graphics`). Writers to
  update are in ADR-240's Order of work.
- First step, not an interim: the table, the remaining lists derived from it
  (a missing role is a compile error), and `sortProblems` reading it.
- `normalInsertSize`'s pinned band reaches the worker on `WorkerFacet` alone,
  so an `svKind` filter without an `svKind` facet files a too-close LR pair by
  the sampled band. Moving the band to a top-level RPC arg, sent when either
  reads `svKind`, needs `tables.ts`'s `workerFacet` call changed with it.

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

- **Tag-value colors landed 2026-11-08**: dealt over `TAG_PALETTE` into the
  session's held slots (ADR-205's amendment). Goldens recolor only where two
  values on screen collided or sat near-twin (HP:4 steps off HP:3's), and for
  HP:0 and integers past 10, which no longer wrap onto the first ten.
- **The tables key: declined as written.** `colorKeyTables(colorScalesIn(theme))`
  flattens every categorical scale into one `legend`, and
  `getAlignmentsColorScales` empties the arc scale into the read one under a
  shared color, which is the merge `4799413495` reverted for ggjbrowse's
  separate layers. The one real divergence, the arc key not folding a split
  class into its pair twin (`oneRowPerSplitTwin`), is fixed in the tables.
  Still open: the display's overlap-tint row (`getOverlapLegendItem`) has
  swatches and no color, so the export keys ggjbrowse's `overlaps` layer with
  nothing; a key with label and color columns needs a decision on what that
  row is. If a third fix lands on both keys, give `getAlignmentsColorScales`
  an unmerged per-layer form the tables call per layer.
- **Group by dialogs share `@jbrowse/display-kit/GroupByDialog`** and one
  default rule (`colorsWithGrouping`). Open, Colin's call: what unticking
  does. Alignments' `groupByColor` undoes only coloring by the field in the
  box; features' also clears a color by the previous grouping's field, so
  regrouping from A to B at the box's default drops color A unasked. The
  recommendation is alignments' rule for both, which changes
  `groupBySections.test.ts`.
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
