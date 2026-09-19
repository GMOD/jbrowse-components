---
name: grammar-vocabulary-for-wiggle
description: The wiggle displays adopt the grammar's config vocabulary without adopting its renderer, in three packages after ADR-141 — package A's shared value-scale factory landed as ADR-142 on 2026-09-19 with its docs sweep behind it; B is the colour object with a threshold scale, C the single/multi display merge through `facet: 'source'` — with the column encoder and the wiggle port parked on the bench verdict.
---

# Grammar vocabulary for the wiggle displays

State on 2026-09-19, after the grammar review's four packages (ADR-141 and
the six commits behind it, the column-encoder bench and verdict, the docs
sweep, the tooltip and legend hint) and package A below landed on main. Two
independent Fable reviews checked the plan; the second's verdicts are folded
in below. The read_marks demo config is deployed and its three figures
reshot; the push CI for ADR-141 ran green, jbrowse-web project included.

## Still to do by hand

- Reshoot every figure whose spec moved `minScore`/`maxScore` onto
  `scales.y` in package A's docs sweep (the sweep's report lists them), and
  push the CI for ADR-142: `ConfigSlotDefaults.test.ts.snap` was hand-edited
  and the jbrowse-web project did not run locally.
- Package C needs a design review before an agent starts (below).

## Decided, do not reopen without new evidence

- **No `y2`, no second axis, no inherited display `encoding`, no `{ field }`
  on positional channels**: ADR-141's Rejected rows.
- **The column encoder is parked.** `ideas/column-encoder-verdict.md`: time
  parity with wiggle's packer, but 20 retained bytes a feature against 12, and
  the 5-10x headline is against a `SimpleFeature` per row that no display
  builds (BigWig hands the encoder a two-field cursor). Revisit on a measured
  slow declared pileup, and run a `BigWigFeature` arm before quoting it.
- **The wiggle displays do not move onto the mark list.** ADR-127 reopens only
  when `EncodedChannels` can decline an identity `featureIndex` and carry a
  constant colour as a scalar — the verdict's two lane changes — not on a
  golden-parity test, which a line rendering makes unreachable while ADR-127
  stands.
- **No `lookup` transform.** Manhattan's LD needs a runtime parameter, a
  two-key join, a warning flag, an index glyph and a threshold scale.

## The three packages, in order

**A. A shared value-scale factory — landed, ADR-142.** `valueScaleSchema({
types, autoscale, symlogConstant })` in wiggle-core, spread as `scales.y` on the mark display (already there with
`type`, `domainMin`, `domainMax`), wiggle, multi-wiggle, Manhattan and the
alignments coverage band, replacing `scaleType`/`minScore`/`maxScore`/
`autoscale`/`numStdDev`/`numQuantile`/`symlogConstant` slots. Flat members,
Vega-Lite's spelling. A factory rather than one object because the four
displays' scale enums and defaults differ, and a fixed object would put the
dead `autoscale`/`numStdDev` back on the mark display and Manhattan. Nothing
crosses the wire, so no refetch. The mark display gains the autoscale modes
as a feature (score stats over its `y` lane on the main thread).
`ScoreScaleMixin` becomes the `scales.y`-backed composer of `ScoreAxisMixin`;
the `Number.MIN_VALUE` sentinels go. Traps: `applyDisplaySettings` replaces a
sub-schema whole (`BaseDisplayModel.tsx` `setSubschema(key, value ?? {})`), so
the settings-bag and session-spec route needs a merge; jbrowse-img's
`--autoscale/--minmax/--scaletype` write the old slots
(`products/jbrowse-img/src/applyTrackOpts.ts`); the alignments display has a
pileup beside its band, so decide the slot's name there first. One Opus
session for schema, model, menus and img; a docs and sweep agent behind it.
Sweep: 30-45 source files, 4-7 test_data configs, jbrowse-img and two react
example sites, `ConfigSlotDefaults`/`RestatedMixinSlots` tests, ~14 guides and
3 tutorials.

**B. The wiggle colour object.** `posColor`/`negColor`/`bicolorPivot`/
`useBicolor`/`colorImpliesSolid`/`densityColorRamp` and both `SetColorDialog`s
become the shared colour object: xyplot
`{ field: 'score', scale: 'threshold', domain: [0], palette: [neg, pos] }`,
density a ramp with a midpoint, solid a bare string, through
`ChannelSpecDialog`. Two prerequisites in order: a `threshold` scale in
display-kit (`COLOR_SCALES` has none; Manhattan's `ldBins.ts` is the second
consumer, which clears ADR-040; the shared `domain` slot is `stringArray` and
grows a numeric form), and deleting the worker-side sign split
(`ideas/wiggle-instance-records-carry-per-row-constants.md` §4; the GPU already
colours by sign off a uniform), else `color.domain` becomes a fetch key.
Multi-wiggle's per-source colour stays on the adapter as
`{ field: 'source', scale: 'categorical' }`. Own ADR.

**C. The single and multi wiggle displays merge.** `facet: { field: 'source',
domain }` replaces the tree-sidebar `domain` row-order slot (which collides
with the score axis's word) and collapses the nine multi renderings to five:
overlay is facet off, multirow facet on, `SINGLE_TO_MULTI_RENDERING` goes.
`LinearWiggleDisplay.gpuProps` already maps itself onto the multi build path as
one source. Needs a design review before an agent touches it: the tree sidebar,
clustering and sort-at-position read rows and would read facet sections.

## Where the working notes are

The plan revisions and both Fable reviews were written to this session's
scratchpad and are not in the tree; this file is what survives. The ADRs and
the verdict above carry every measurement.
