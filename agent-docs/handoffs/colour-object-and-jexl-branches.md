---
name: colour-object-and-jexl-branches
description: Two unlanded branches from a 2026-09-21 review of the grammar-of-graphics colour work, and the ordered steps after them. The colour branch (the retired palette/ramp words fixed, one colour resolver) is complete and waits on landing; the jexl branch (featureField slots, contextVariable admitting jexl) has a WIP last commit that must not land yet. Then the wiggle origin/pivot split, the Solid-and-back redesign, colour rules on every display, a wiggle threshold with N cuts, and the lane-split table. Read before touching colorEncodingOf, a colour object's field slot, jexl admission in ConfigSlot, or a menu's constant/field switch.
---

# Colour object and `jexl:` admission: two branches and what follows

Background: [GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md),
[ADR-133](../architecture-decision-records/adr-133-a-channel-objects-slots-are-each-valid-alone.md),
[ADR-151](../architecture-decision-records/adr-151-a-channels-scale-is-spelt-as-scales-y-spells-one.md).
A 2026-09-21 review, re-checked by an adversarial second reviewer, found the
shared colour object spelt one way on six displays but resolved six ways, and
`jexl:` doing two jobs under one prefix. Mark an item **landed** with its
commit; file what nobody takes up into [ideas/](../ideas/README.md) and delete
this file.

## The two branches

Land the colour branch first: the jexl branch changes `colorChannelSlots` in
`packages/display-kit/src/colorConfigSchema.ts`, which the colour branch
rewrites around.

### Colour object: `worktree-agent-ac0d2456e8b2051c9`

Worktree `.claude/worktrees/agent-ac0d2456e8b2051c9`.

- `8e863417fc` — the retired `palette`/`ramp` words leave the docs, including
  the canvas `color` slot doc three public config pages generate from and
  `agents_live_model.md`, both of which taught a spelling the app refuses.
  ADRs 113, 131, 133, 135, 144, 148 and 149 strike their superseded parts and
  point at ADR-151. The spec recipe read `scale.palette`, a live bug, now
  tested. Complete and gated.
- `c3c98ee016` — every display resolves its colour object through
  `colorEncodingOf`; WiggleColor's `field` is `score | source`, and a
  field/scale pair wiggle cannot paint paints `MISCONFIGURED_COLOR`. Complete;
  typecheck, lint and 826 suites green, `verify --full` not run.

To land:

- The branch carries Colin's pre-amend "Update genomespy" (`88292144a6`), which
  main holds amended. Replay only the two commits:
  `git rebase --onto main 88292144a6`.
- Its ADR is numbered 152, which main already holds
  (`adr-152-wiggle-stays-off-the-column-encoder-until-two-lanes-go.md`).
  Renumber it to the next free number and fix the links.

Found and left: the wiggle density ramp measures distance from `domainMid`
rather than placing its middle stop there, and a `linear` scale with no range
falls back to the two-sided fade instead of viridis. Fixing either changes how
signed density tracks look, so it waits on Colin. `alignments-colour-pipeline.dot`
is stale on main (`pnpm diagrams:check`).

### `jexl:` admission: `worktree-agent-a5f8cb6038ff6552e`

Worktree `.claude/worktrees/agent-a5f8cb6038ff6552e`. Two markers: a
`featureField` slot type the config reader returns unevaluated (a field name,
a dotted path, or a `jexl:` expression `fieldReader` evaluates per feature),
and `contextVariable` as the declaration that admits a `jexl:` callback.

- `4c1473df40` — the `featureField` slot type. Complete and gated.
- `eddcab3882` — 12 field-reference slots become `featureField`: `facet.field`,
  the mark encoding's `x`/`x2`/`y`/`row`, the glyph field, `partitionField`,
  `clusterField`, and FeatureColor's, ManhattanColor's and MarkColor's `field`.
  Complete; 773 plugin suites green.
- `06229121c6` — the variant displays' `featureColor` and GWASAdapter's
  `scoreTransform` declare `contextVariable`. Complete.
- `a28abf95c1` — the volvox configs drop a per-feature colour a wiggle cannot
  paint. Only the pre-commit hook ran.
- `c5eb423e5e` — **WIP, do not land.** The refusal itself. Missing: its ADR
  (`CONFIG_PATTERN.md` and `packages/core/src/configuration/CLAUDE.md` already
  link it, so `check-docs` fails), the full non-web suite, `verify --full`, a
  final census over the registered schemas, and the rebase.

Three crashes become tests that failed on main: a canvas
`facet: { field: 'jexl:…' }`, a `jexl:` colour field on Manhattan, and
GWASAdapter evaluating `scoreTransform` with no score.

Left on that branch:

- The colour `field` on WiggleColor, AlignmentsColor, SyntenyColor and
  RibbonColor stays a plain string that refuses `jexl:`, through a required
  `fieldType` parameter on `colorChannelSlots`. This is the conflict with the
  colour branch.
- A `jexl:` string inside an array slot's entry (`jexlFilters`, `groupby`,
  `pileup.fields`) is not refused.
- `jb2export`'s `color:` modifier cannot carry a `jexl:` value through its `:`
  split.
- In products without MST type checking (everything but web), the refusal is
  the snapshot preprocessor alone.
- `geneColor.ts:74` reads `utrColor` behind an `isJexl` guard, red on main:
  the item [adr-150-review-followups](adr-150-review-followups.md) records.

## After both land, in order

1. **Wiggle bars grow from `origin`.** `wiggleComponentUtils.ts` sets
   `origin: self.wiggleColor.pivot`, so a colour cut moves where bars grow
   from, against ADR-144. The plan: a `pivot` uniform beside `origin` in
   `wiggleCommon.slang`; bars keep `u.origin`, while the line, line-centre,
   band and density shaders read `u.pivot`; `pivot` joins
   `WiggleGPURenderState`, `WiggleParams` and `writeWiggleUniforms`; the
   Canvas2D painters split the same way; `makeSummaryLayers` orders layers by
   `origin` and colours them by `pivot`. The first test: `origin` 0 with
   `domain: ['2']` gives a render state with origin 0 and pivot 2. Check
   `gen:shaders`'s exit code, and keep
   `webgpuHalBindingVisibility.test.ts` green.
2. **Solid-and-back: drop `none`.** The direction Colin approved on
   2026-09-21: a colour object maps if and only if it names a field, and the
   way back lives in display session state, written by one display-kit helper
   that replaces the five writers (`colorSnapshotFor`, `syntenyColorFor`,
   canvas's `setFeatureColor`/`setColorScale`, Manhattan's `colorBy`,
   multi-way's `setGeneColorBy`). Undo alone does not cover it: on Desktop and
   for a Web admin the edit lands in `root.jbrowse`, outside the history's
   `../session` target. `showSoftClipping.test.ts` ("Normal and back keeps
   the field, range and ends of a linear tag") pins today's lost kind. The
   same change settles:
   - Manhattan re-picking the current field writes `scale: undefined` and
     drops a declared threshold.
   - LGVSyntenyColor's three states (strand by default, the plain fill, a
     constant): `shorthandWith: { field: '' }`, or strand moved into a
     track-type default.
   - `AlignmentsBaseColor.scale`, whose only member is `none`, the question
     [adr-149-base-color-audit](adr-149-base-color-audit.md) leaves open.
   - Canvas's Default dropping a track author's colour,
     [colour-menu-default-and-grammar-ideas](colour-menu-default-and-grammar-ideas.md).
     One writer answers both, so decide them together.
3. **Colour rules on every display.** `threshold-cuts`, `ramp-domain` and
   `ramp-ends` live only in the mark display's rule list
   (`plugins/marks/src/LinearMarkDisplay/markProblems.ts`), so a bad colour
   object says nothing on the other five displays. Move them beside the object
   in display-kit and give each display a `notices` getter and its chip;
   `jbApi.ts` already reads `display.notices` duck-typed. Add the missing check
   that a threshold's `range` has one more colour than its cuts
   (`thresholdPalette` tops it up silently). With the rules moved, a small
   shared workspace package beats `scripts/generateMarkRules.ts`'s copy into
   the CLI, as `@jbrowse/add-track-core` is shared today; without the move,
   keep the copy.
4. **A wiggle `threshold` with N cuts**, by ggplot2's rule that a segment takes
   its start point's bin. Fills cost nothing, since each instance carries its
   colour; the lines and band are a shader change to `pivotSideColor`. After
   step 1.
5. **The lane-split table.** Branch `lane-split-on-lazy-shaders`
   (`db22edd79c`, whose ADR is also numbered 152). `shapeSpecs.ts` lands alone
   if `rows: 'banded'`, the row skip in `markLanes` and the `banded` flag in
   `markEntryOf` stay on the branch. The second shader pass per shape waits on
   lazy layout modules, 14,173 bytes per realm eager today. The superseded
   copies `lane-split-held`, `worktree-agent-a17c3133a78d5d594` and the
   replaced validator draft `worktree-agent-ac122262301221b0e` can go.

## Declined in the review

File these into ADR-151's and ADR-148's Rejected rows when the thread closes.

- **`domain: [min, max]` under a linear colour scale**, Vega-Lite's spelling.
  It brings back two spellings of one pin and a precedence rule, and `scales.y`
  has one. Step 3's report is the fix for the trap.
- **Renaming alignments' runtime scheme names to the field names.** The shader
  takes an integer, so no hot path gains, and `ReadColorBy`'s parsed tag form
  is worth keeping.
