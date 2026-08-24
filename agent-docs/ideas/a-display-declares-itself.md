---
name: a-display-declares-itself
description: A multi-level simplification target whose Level 0 has RUN and been REJECTED, and whose subject, defineDisplay, was then removed from the tree with it (ADR-091, which also rejects ADR-089 and ADR-090) — read the Result section at the top before anything else. On an unlanded branch Manhattan was ported to defineDisplay and came back off it, and the settings declaration (params.ts) left behind was rejected too: every field the port added to the factory was an override hook, and the table eliminated nothing. Levels 0.5 to 5 below are written against a factory that no longer exists; what survives of them is the census and the placement question (Level 2). The measured target is 60 declarable getters and not ~90, out of 321 and not 288, and the count ELIMINATED is 0 — deleting a display's own getters moves the break to its public surface, so this is not a getter-reduction play. What survives: the table as the one place a setting is named, and `affects` as a claim a per-display check holds a display to. What was tried and reversed: resolving the table into a bag on the model, which erases the types the config readers derive and needed four pieces of machinery to buy back. What does not: Level 1's ambition of deriving menus and legends from the table — the declaration standardizes a setting's plumbing, not its meaning. Do not convert a display that composes a cross-cutting mixin for a setting until the two-owner seam has a check.
---

# A display declares itself

[ADR-089](../architecture-decision-records/adr-089-a-track-type-is-a-spec-the-factory-composes-the-stack.md)
and [ADR-090](../architecture-decision-records/adr-090-a-mark-is-a-shape-plus-its-channels.md)
established that a track type can be a spec. Both were gauged on
`example-plugins/score-example`: two settings, no layout, one mark, three files
and 176 lines. That gauge answers "can a third party author a display". It
cannot answer "is this system simpler", because the in-tree displays it does not
reach are where every measured cost sits.

This is the plan for the second question, written against a census taken
2026-08-24. Level 0 has since run; the Result section immediately below records
what it returned and which numbers in this doc it corrected.

## Result: Level 0 ran, 2026-08-24

Everything below this section is the plan as written before it ran, kept
unedited except where a number in it is now known to be wrong (each such place
says so and points here). Read this first; it changes what several of the levels
are worth.

**Level 0's port happened, and then came back off.** `LinearManhattanDisplay`
was ported to `defineDisplay` and scored against a pre-committed budget
(the commit range on the unlanded `worktree-manhattan-lazy-spike` branch;
[ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)
records the decision not to land it). The port fit. What it cost was measured afterwards and was not in the budget: 40
modules and ~240 KB of source moved onto the gwas plugin's startup path,
because a state model is eager and everything a spec names by value is eager
with it; four generated censuses lost the display, two silently; and two of the
port's structural claims did not hold as written.

So the reusable half moved BELOW the factory. `packages/display-kit/src/params.ts`
is a settings declaration — data that builds the schema and carries what each
setting invalidates, which a display's getters do NOT read through;
`defineDisplay` is one assembly of those pieces rather than the destination for
in-tree displays. On the branch, Manhattan and `LinearHicDisplay` were both
converted to declare themselves, on different fetch foundations, composing
their own MST chains. **None of it landed**: the measurements below are what
ADR-091 rejected the declaration on, and what was salvaged from the branch is
listed in that ADR's Consequences. The factory itself, `defineDisplay` and the mark
system (ADR-089, ADR-090), was then removed from the tree on the same evidence,
so every mention of it below is historical.

### The numbers in this doc that did not survive

A census of the four model files against the real mechanism (not the estimate
this doc was written from):

| this doc says | measured |
| --- | --- |
| 288 `#getter` across four files | 321 — the count omits `alignments/…/configSlotViews.ts`, 32 getters and the single most declarable block in the tree |
| ~90 reducible settings-and-UI getters | **60** are declarable at all |
| (implied) the mechanism reduces that count | **0 eliminated.** Both converted displays kept one hand-written getter per param; only the right-hand side changed |

The last row is the one that matters. Deleting those getters means every
consumer — menus, dialogs, renderers, SVG export, third-party plugins — spells
`display.declaredParams.showCoverage` instead of `display.showCoverage`. That is
a break in the display model's public surface, so **the declaration is not a
getter-reduction play and should stop being described as one.**

Two more measurements worth carrying:

- `canvas/LinearBasicDisplay` has **3** declarable getters out of 47 despite ~25
  slots, because it transports its settings wholesale
  (`getConfigSnapshotWithPromotables` + `pickDisplayConfig`) rather than reading
  them one at a time. The display with the largest slot table has the smallest
  declarable surface.
- The derived fetch bag is a display's whole `rpcProps()` on **1 of 6** displays
  examined. Alignments transports 5 of 12 fields verbatim, canvas 0 of ~12, MAF
  0 of 2, HiC 0 of 2. The values that invalidate a fetch are usually *derived* —
  a precedence ladder, a resolution against fetched metadata, an ordering — and
  raw-slot-verbatim transport is the special case. The same holds for the encode
  side, where the derived bag found zero consumers in two displays and was
  deleted.

### What does generalize

Not factory residence, and not getter count. Three things:

- **A read discipline that cannot be got wrong.** `read: 'resolved'` is required
  at the type level for a promotable slot and rejected for any other. Promotable
  slots store a sentinel, so a plain `getConf` on one answers `undefined` where
  the display-type default is what the user sees, and nothing at any layer
  reports it. 19 promotable slots across the four big displays, and the census
  found zero live instances.

  **The census and I both then got the reason wrong**, and the correction
  matters: `getConf` on a promotable slot is typed `T | undefined` where
  `resolveConf` is typed `T`, and `ConfigurationSlotValue` in
  `core/configuration/types.ts` describes itself as "the whole compile-time
  guard". The wrong verb at a typed call site is already a compile error. Zero
  violations is the type system working, not convention holding. What
  `read: 'resolved'` actually buys back is the guard `readParams` gives up by
  looping into a `Record<string, unknown>` and asserting the result — which is
  an argument against the bag, not for the axis.
- **`affects` as a statement a check can hold a display to.** Not as something
  to derive a bag from, which works on one display in six. HiC's
  `paramsInvalidate.test.ts` is the shape: drive the tags off the table and
  assert each one moves the fetch signature, or re-encodes, exactly when it
  claims to.
- **A fetch input that is session state is a declared param**, so a volatile —
  the fetch's own result — cannot reach an RPC cache key. That makes the
  documented `rpcProps()` loop trap unwritable rather than warned about, which
  the earlier `rpc.inputs` hook did not: it took the whole model.

### What this costs, and the open question

The tree already had a better answer for the reducible getters, and it is not
this. Six cross-cutting mixins (`LegendMixin`, `HeightModeMixin`,
`RowHeightMixin`, `TreeSidebarMixin`, `ScoreScaleMixin`,
`WiggleScoreConfigMixin`) each bundle **slot table + getter + setter + pin +
menu row + dialog** and retire that whole triple across four to eight displays.
The declaration bundles slot + `affects` + read discipline and leaves the rest
where it was.

So a shared setting now has **two owners** — the declaration owns the slot, a
mixin owns everything you touch it with — and nothing checks they agree. The
seam is already open: `symlogConstant` was read by a mixin against a host whose
schema never declared it, silently, for as long as both existed (fixed
`d740bb0d6f`), and `scatterPointSize` is declared twice with different
`promotedBase` and read once. **Do not convert a display that composes a
cross-cutting mixin for a setting until that seam has a check.**

### Consequences for the levels below

- **Level 0** is done and its verdict is above. Its own framing — "if Manhattan
  does not fit, the imperative altitude is the real contract" — asked the wrong
  question. Manhattan fit; the cost was elsewhere.
- **Level 1** survived only in its smaller form, the declaration metadata on
  existing models, which is what the branch did and what ADR-091 then
  rejected. Its larger ambition — deriving the
  menu row, the legend, the config slot, the session key and the CLI spelling
  from a channel table — is **not supported by the evidence**. The guard this
  doc names as the deciding one (write alignments' `colorBy` declaration first)
  was run: the declaration holds `colorBy` as a param — one `maybeFrozen`
  promotable slot with a `validate` — and says nothing whatever about the
  six-variant union with a nested six-field `modifications` object inside it.
  **The declaration standardizes a setting's plumbing — where the value lives,
  what changing it invalidates, how it must be read — and not its meaning.**
- **Levels 0.5, 2, 3, 4, 5** are untouched by this and stand as written. Level 2
  in particular was always independent.

---

## What the census says

Three things get called complexity here, and they have opposite answers.

| Axis | Measured | Verdict |
| --- | --- | --- |
| Drawing | 57 `.slang` in tree, `render-core` 7,648 lines, `GpuHal` 17 methods, `RenderingBackend` 2 | already the healthiest layer |
| Layout | five independent placement implementations; `sortLayout.ts` 1,096 and `layout.ts` 1,741 lines | bespoke, and mostly correctly so |
| Declaration and its consequences | 178 config slots, 52 volatiles, 288 getters in four model files | the whole cost |

The last row is the one nothing is aimed at. Four model files hold it:

| File | Lines | `#getter` | `#action` |
| --- | --- | --- | --- |
| `alignments/LinearAlignmentsDisplay/model.ts` | 3,896 | 115 | 66 |
| `maf/LinearMafDisplay/stateModel.ts` | 2,452 | 78 | 26 |
| `canvas/LinearBasicDisplay/baseModel.ts` | 1,947 | 47 | 23 |
| `variants/shared/MultiSampleVariantBaseModel.ts` | 1,697 | 48 | 19 |

And five surfaces are written by hand **against** those getters, once per
display:

| Surface | Cost | Copies |
| --- | --- | --- |
| track menus | 6,822 lines in plugins (+5,153 of shared machinery in packages) | one per display |
| dialogs | 8,692 lines | 40 files |
| legends | 4,058 lines | 27 files |
| hit tests | 21 files; 3,335 lines in alignments alone | one per mark, per display |
| renderer classes | 5,353 lines | 27 `Gpu*Renderer` / `Canvas2D*Renderer` / factory |

**A display today does not declare anything about itself. It *is* its getters.**
Every one of those five surfaces exists because there was nothing machine-readable
to derive it from. That is the single fact this whole plan is against.

### But 288 is not the number this plan can move

Reading "the whole cost" as "288 getters are reducible" is the trap this table
sets, and the boundary below excludes most of them. Split the same 288 by body
size and by whether the getter reads config at all — walk each `#getter` to its
`get x(` and brace-match the body:

| Of the 288 `#getter` | Count |
| --- | --- |
| body is three lines or fewer | 144 |
| reads `getConf` / `readConfObject` / `resolveConf` anywhere | 47 |

Categorizing alignments' 54 short ones: roughly 25 settings, 9 capability
predicates (`canSortReads`, `canSizeGroupHeights`, `gateEnabled`), 7 heights,
7 data plumbing, and 3 of the sentinel-plus-resolved-getter pairs CLAUDE.md
mandates (`mismatchAlphaDisplayTypeDefault`, `effectiveGroupBy`) — a rule
being followed, not a defect.

The remaining ~61 in that file are `laidOutByGroup`, `laidOutByGroupFramed`,
`sections`, `renderSections`, `bezierPairSections`, `crossRegionArcSections`,
`scrollableHeight`, `pileupContentHeight`. That is **layout**, which the thesis
below says stays imperative, deliberately and correctly.

So the target is **the ~90 settings-and-UI getters and the five surfaces written
against them**, not 288. That is still the largest reducible thing measured here.
It is not two thirds of the model files, and a level that claims to be is
measuring the wrong denominator.

> **Both numbers here are wrong, measured against the real mechanism.** The
> denominator is 321, not 288 — this count omits `configSlotViews.ts`. The
> target is 60 declarable getters, not ~90. And the count the mechanism
> *eliminates* is 0, because deleting a display's own getters would move the
> break to its public surface. See the Result section at the top.

## Where the grammar stops, and why that is the finding

The obvious move is a grammar of graphics — the vendored comparisons are
`~/src/vendor/genome-spy` (74,485 lines core, **six** marks: `rect`, `point`,
`rule`, `link`, `arrow`, `text`) and `~/src/vendor/gosling.js` (22,128 lines,
**ten** data marks over PIXI, compiling onto HiGlass). Both are smaller than
this system in a specific and informative way.

The grammar's unit is **a datum with channels**. This system's expensive units
are **a cross-region layout** and **a level-of-detail tier**, and no grammar has
a vocabulary for either. Vega-Lite cannot say *pack these intervals into rows so
they do not overlap, stably under pan, sorted by an anchor at a locus the user
clicked, across a region boundary*. genome-spy has real genomic sources
(`bamSource`, `vcfSource`, `tabixSource`) and no pileup. That is not an
oversight in their design; it is the boundary.

So the position, and it is a stronger one than either adopting or ignoring the
grammar:

> **Take the grammar at the declaration layer. Stop it at layout.**
>
> Channels, scales and marks are declarative and shared. Placement, tiering and
> the fetch stay imperative and per-display, because they are where the domain
> actually is.

**This does not restate RFC-001 §2 on narrower ground. It re-opens §2 on §2's own
ground**, and quoting one of §2's three objections is what obscures that.
The full non-goal ("no glyph-registration / spec-grammar / DSL layer") rests on:

- **"Unmotivated at both ends"** — the simple BED-like case is already covered by
  the canvas plugin's config, and the complex case, **which §2 names as Manhattan
  and methylation matrices**, "needs the full mixin/RPC/render shape regardless."
- It "would replace only the render-callback layer, **lose per-feature batching,
  conditional paths and custom hit-testing**."
- It would "add indirection that does not earn its keep."

The middle clause of the second bullet is the quotable one, and on its own it
reads as an invitation to aim elsewhere. The first bullet names Level 0's exact
target, and the phrase "custom hit-testing" is what Level 3 proposes to derive —
a head-on collision, not a narrowing.

That is a better position for this plan, not a worse one: it means Level 0 is a
sharper experiment than it first appears. If Manhattan ports, the "complex
case needs the full shape regardless" clause is falsified on the case §2 chose.
But the doc has to own that it is contesting §2 rather than refining it.

## The levels

Named rather than numbered, because only the dependency order below is fixed.

---

### Level 0 — Re-gauge the factory on a display that is hard

> **Done, 2026-08-24 — see the Result section at the top.** Manhattan fit the
> factory and then came back off it, because what generalizes is the
> declaration rather than factory residence. What follows is the plan as
> written, kept because the gauge it commits to is what made the result
> scoreable.

**Today.** `defineDisplay` is measured against the easy case, and
`a-track-type-is-five-primitives` (since rejected, see REJECTED_IDEAS) said in so
many words that alignments "stays on the full stack and is not a target". Every
level below assumes the factory can hold a real display. Nothing has tested that.

**The move.** Port `LinearManhattanDisplay` (2,180 lines, 24 files, 6 slots, 3
properties, 0 volatiles) to `defineDisplay`. It is the smallest display that has
all of: a real scale, a real hit test, a legend, a tooltip, a hand-written
shader, and a `renderSvg`. The todo
[put-the-manhattan-display-on-plotgeometry](../todo/put-the-manhattan-display-on-plotgeometry.md)
is the same complaint arriving from the wiggle side.

**Fix the denominator before porting, or the gauge proves nothing.** "2,180
lines, 24 files" reproduces exactly, but only as `LinearManhattanDisplay/`
*excluding* `shaders/` and `ManhattanRPC/`. What that leaves inside:

| Inside the 2,180 | Lines | Can a declaration derive it? |
| --- | --- | --- |
| `stateModelFactory.ts` | 795 | mostly, and this is the real target |
| React components (7 files) | 583 | **no** — see below |
| `configSchemaFactory.ts` | 192 | yes, from `params` |
| `Canvas2D`/`Gpu` renderer pair + base | 207 | yes, ADR-089 already does this |
| `findManhattanHit.ts` | 142 | only if Level 3 lands |
| `renderSvg.tsx` | 84 | yes |
| `ldBins.ts`, `isIndexSnpOffscreen.ts`, `index.ts`, types | 177 | no, domain |

Outside it and not going anywhere: `manhattan.slang` (190) plus its four
generated files (186), and `ManhattanRPC/` (190), whose `makeLdEvaluator` is a
real domain computation with no channel expression.

The 583 lines of components are 27% of the target and nothing in Levels 1-5
derives an `LdIndexWarning` or a `HoverHighlight`. `SetSignificanceLineDialog`
and `LdColorLegend` are the only two a declaration plausibly reaches.

**Gauge.** Write the derivable / stays-hand-written split above as a commitment
*before* the port, then: the derivable column under 400 lines, no renderer class,
no `rpcProps`/`gpuProps` split written by hand, tooltip and legend intact,
`renderSvg` unchanged in output. A gauge whose denominator is settled afterwards
can be declared a pass or a fail at will, which is the one thing a falsification
step must not allow.

**Falsifies.** If Manhattan does not fit, the imperative altitude is the real
contract and the levels below shrink to Level 1 and Level 2 only. **Find this out
before writing another shape.**

---

### Level 0.5 — Reconcile the two Mark systems, or separate them on purpose

**This level was missing, and Level 3 cannot start without it.** There are two
unrelated things called a mark in the tree, and citing both in one sentence as
though they were one lineage is the easy mistake:

| | `packages/display-kit/src/marks.ts` | `plugins/alignments/src/features/mark.ts` |
| --- | --- | --- |
| Size | ~60 lines | 249 + five feature marks |
| Shapes | `export type Mark = BarMark` — **a union of one** | `gap`, `mismatch`, `arcs`, `perBaseQuality`, `perBaseLetter`, `softclipBases` |
| Colour | `(params) => string`, one uniform per frame | per instance |
| Geometry | `x` / `x2` / `y` off parallel payload arrays | `MarkFrame` + `MarkCanvas2D` with `contiguous` / `bandTop` / `bandHeight` |
| Depends on | nothing above render-core | `pileupRowY`, `pileupRowOffCanvas` from alignments' own renderer types |
| Feeds | `defineDisplay` | alignments' three backends and its hit test |

ADR-090's mark is the published one and has never expressed a per-instance
colour. Alignments' mark is the one that actually deleted the third copy of five
features and found the GPU/Canvas2D bug — and it **depends on pileup row
geometry**, which puts it downstream of layout.

That is the problem in one line: **the mark abstraction that works is below the
layout boundary this plan draws, and the one above the boundary has one shape.**

**The gap decomposes into two parts, and they have different answers:**

- **Per-instance channels.** Level 1's relitigation of ADR-090 closes this one.
  Once a channel can be a field rather than a constant, display-kit's `Mark` can
  express what `rowRect` and `arc` already draw, and most of the distance between
  the two systems is gone. This is the larger half and it is tractable.
- **Row geometry.** `MarkCanvas2D`'s `bandTop` / `bandHeight` / `contiguous`
  resolve against a pileup row, so alignments' mark reads layout output. This is
  the half that touches the boundary, and it is the real question.

**The move.** Answer only the second: does a mark take its row band as an
*argument* — layout stays imperative, hands the mark a resolved `rowY` and
`featureHeight`, and the boundary holds — or does the mark reach into layout, in
which case the boundary moves and the thesis paragraph needs rewriting?

The first looks right, and it is close to what `MarkFrame` already does: it is
handed a `DrawBlock` and a span rather than computing one. If that holds, the two
systems converge with no boundary change, and the alignments mark becomes the
proof that display-kit's can carry a real display.

**Gauge.** One sentence in ADR-090's successor naming which. If it is "takes the
band as an argument", the convergence is a refactor, not a redesign.

**Risk.** The cheapest level here and the one that most changes what Levels 1 and
3 are allowed to claim.

---

### Level 1 — The channel, and the scale

> **Half-falsified — see the Result section at the top.** The smaller form (the
> declaration metadata on existing models) landed and works. The larger one
> below — deriving the menu row, the legend, the session key and the CLI
> spelling from a channel table — is not supported by the evidence. This
> section's own deciding guard, "write alignments' `colorBy` declaration first",
> was run and the table holds the slot while saying nothing about the union
> inside it.

**Today.** `colorBy` is three unrelated types wearing one word: a six-variant
discriminated union with modification sub-options in
`plugins/alignments/src/shared/types.ts`, a bare attribute-name string in
`variants/shared`, a mode enum in `synteny-core`. `groupBy` is two. Each one
drags a private menu builder, a private legend, a private persisted shape and a
private jb2export CLI spelling. `packages/wiggle-core/src/scale.ts` is shared by
four consumers (wiggle, Manhattan, alignments coverage, MAF coverage) and proves
the shape works; Hi-C's saturation point, the LD ramp and the insert-size ramp
are each their own arithmetic beside it.

**The move.** One `Channel` and one `Scale`, in a package below the plugins. A
display declares which channels it supports and what may fill them — the way
genome-spy's marks declare `getSupportedChannels()`:

```ts
channels: {
  color: { fields: ['strand', 'insertSize', 'tag', 'modifications'], legend: true },
  group: { fields: ['strand', 'tag', 'pairOrientation'] },
  sort:  { fields: ['start', 'strand', 'tag'] },
}
```

**The critical scoping, without which this is wrong.** A channel is a
**declaration and a UI contract, not a resolution**. Alignments' colour is a
precedence ladder resolved in the worker into a byte array and it stays that way.
What derives from the declaration is the menu row, the legend, the config slot,
the session key, the CLI spelling and the config-docs page. `resolve` remains
per-display. genome-spy makes exactly this split: the channel list is a
declaration, the encoder is per-mark.

**The UI half has a mechanism already, and it is not called a channel.**
`defineDisplay.tsx` has
`ParamDefinition = ConfigSlotDefinition & { affects: 'fetch' | 'encode' | 'frame' }`.
Extending that with the UI-derivation metadata — label, legend, where the options
come from — derives all six of the things listed above, is already rooted in the
factory, and costs one type. It also fixes this level's place in the order:
**Level 1 depends on Level 0**, because it extends the factory's own type. It is
not parallel to Level 2.

#### Relitigate ADR-090's per-frame colour while doing it

ADR-090 says "`color` is a uniform per frame, not a lane per instance. A
per-instance color channel... changes the instance layout, so it is **a second
shape variant** rather than an option on this one." That ruling should not
survive this level, and the tree already argues against it:

| Shape | Colour cardinality |
| --- | --- |
| `render-core/shaders/bar.slang` | constant, one uniform per frame |
| `render-core/shaders/rowRect.slang:31` | **`public uint color : ATTR3` — per instance, packed ABGR** |
| `alignments/shaders/slang/arc.slang:103` | **`float colorType : ATTR2` — per instance palette index** |

`rowRect` is the shared "row of coloured rects" primitive that already serves MAF
and multi-row, and it is *one shape* with a per-instance colour lane, not two
shape variants. `arc` carries a third cardinality — an index into a uniform
palette, which is cheaper than an ABGR lane and is what a bounded scheme like
alignments' actually wants.

So the axis is wrong. **Constant-versus-field is channel cardinality, not shape
identity** — it is Vega-Lite's `value` versus `field`, and every grammar treats
it as one concept for the reason that treating it as two multiplies the shape
list: `bar` / `barColoured` / `cell` / `cellColoured`, a combinatorial blowup
over one orthogonal axis. Preventing exactly that is what a channel abstraction
is for. ADR-090 is titled "a mark is a shape plus its channels"; its colour
ruling makes it a shape plus *some* of its channels, and `bar` is the only shape
in the tree the ruling describes.

**The move, then, is bigger than a settings table and better founded**: a
channel declares its cardinality (constant, per-instance value, per-instance
palette index), the pass packs a lane only for the field forms, and the
declaration drives both the render path and the six UI surfaces. That is a real
grammar at the declaration layer rather than a settings table wearing the word.

**This does not reopen the scoping above.** Cardinality is not resolution. The
channel says *whether* colour varies per instance; it never says which colour a
given read gets, and alignments' precedence ladder stays in the worker producing
the byte array the lane is packed from. What the declaration gains is one bit the
pass needs and every UI surface already wanted — constant or field — not the
ladder itself.

**What it costs.** Superseding an ADR two commits old, and a `bar` that packs a
colour lane conditionally. ADR-051 is untouched: the `.slang` stays hand-written
and `rowRect` shows the hand-written version of exactly this.

**Gauge.** `plugins/variants/src/shared/multiSampleVariantMenuItems.ts` (401
lines, 18 hand-written labels) becomes a declaration plus its resolver. The
legend files for that display disappear rather than shrink.

**Deletes.** The reducible half of 6,822 lines of plugin menu code and 4,058
lines of legend, and it closes the first and largest item in
[session-spec-grammar](session-spec-grammar.md).

**Risk.** A channel table that has to express alignments' colour ladder is the
failure mode. Guard by porting alignments' declaration *without* its resolver
first; if the declaration cannot be written in isolation, the split is wrong.

**And that guard does not test the hard part.** The hard part is not the
resolver, it is that the declaration is not a flat field list. `modifications` in
the example block is not a field: `ModificationColorBy` in
`plugins/alignments/src/shared/types.ts` is a six-field sub-object where
`fillUnmarked` and `cytosineContext` change what the mark *means*, `twoColor` is
shared with the `bisulfite` scheme under a different default, and
`hiddenModifications` is a read-only legacy deny-list kept resolving beneath the
allow-list that replaced it. A field list cannot hold that, and a table that
grows a nested-options escape hatch to hold it has stopped deriving anything.

The real guard: **write alignments' `colorBy` declaration first, not last.** It
is the one that decides whether the table is a table.

---

### Level 2 — Name the placement

**Today.** Five implementations, and two of them open with the same paragraph.
Read the doc comments on `maf/LinearMafDisplay/placeMafRows.ts` and
`variants/shared/placeVariantRows.ts` side by side:

> "The worker names rows by species and knows nothing about display order, so
> this is where a fetched row becomes a *placed* row... It is also what lets a
> reorder re-place cached data instead of refetching it."

**The shared paragraph is real, and it is the right thing to have noticed** — the
invariant *a reorder re-places, never refetches* genuinely holds in both, and
naming it is what this level is for. What the shared prose hides is one level
down. On what happens to a row the display is not drawing, the two files decide
inversely, and each records why the other is wrong *for it*:

| | `placeMafRows.ts` | `placeVariantRows.ts` |
| --- | --- | --- |
| Unplaced row | **dropped** | **kept at `HIDDEN_ROW`** |
| Because | "everything downstream — the instance buffer, `rowFlank`, the identity plot — keys on `rowIndex` and would **collide on a shared sentinel**" | at `0x00ffffff` "every painter's own Y-cull already puts the cell millions of pixels below the canvas, so the sentinel **costs no branch**", and it is "chosen to be exactly representable in float32" |
| Returns | a rehydrated `MafRegionData` — a columnar-to-object transform, measured 30ms to 47ms at 83k rows | `Placed<T>`, carrying a **second** index `cellWorkerRowIndices` |
| Second index because | — | the hit test binary-searches the **worker** ordering, which a screen ordering is an arbitrary permutation of |

Neither returns `rowIndex[]`. Both are right about their own downstream.

**The move.** `place(payload, ordering)`, carrying the invariant **a reorder
re-places, never refetches** as a type rather than a doc comment. Two flavours,
both already in tree:

- **Projection** — a name maps to a row. MAF species, variant samples, wiggle
  sources, multi-row groups. Two *named* implementations, not four: wiggle
  sources and multi-row groups resolve `sources[rowIndex]` implicitly
  (`LinearMultiRowFeatureDisplay/model.ts:99`) rather than in a `place` function.
  That is still an argument for naming the primitive; it is not four copies of
  one function waiting to be merged.
- **Packing** — an interval finds a free row. `GranularRectLayout` (canvas) and
  `sortLayout`'s `placeRectCapped` (alignments). Two displays, two copies, and
  alignments' adds a cross-region sort anchor that the shared one would have to
  take as a parameter.

**Settle drop-versus-sentinel before designing the signature.** It is the whole
design: a primitive that takes it as a parameter is a union of two functions with
a shared name, and one that picks a side breaks a display whose downstream was
built on the other.

**Gauge.** MAF and variants place through one call plus a key function, with the
drop-versus-sentinel choice expressed in the type rather than in each caller's
prose, and the two implicit projection sites converted to it.
`ARCHITECTURE.md`'s "Row order is not a fetch input" section becomes a property
of the primitive instead of a rule readers have to remember.

**Then the clustering follows for free.** `packages/tree-sidebar` is 6,043 shared
lines and each plugin's adapter is already thin (62–121 lines: `runWiggleClustering`,
`applyClusterOrder`, `runMultiRowClustering`, `runGenotypeClustering`,
`runMafClustering`). That is the pattern this whole plan is copying — a shared
mechanism plus a per-plugin "what is the matrix" function — and it works today.
Placement is the missing half of it: clustering produces an ordering, and
`place` is what consumes one.

**Risk.** Medium, not Low. "The best evidence and the least design left in it"
is the reading two matching opening paragraphs invite, and their decisions do
not match. The evidence is still the best here — two real implementations, both documented to an
unusual standard — but the design left in it is the largest of any level below
Level 4, because it starts with a semantic conflict rather than a merge.

It remains the one with no equivalent in any grammar system, which still makes it
the better contribution of the two.

---

### Level 3 — Hit derives from the mark

**Today.** ADR-090 closes with "Hit testing does not derive yet." Twenty-one
files are named for hit testing or picking;
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) measured
3,335 lines across `packGpu`/`drawCanvas`/`hitTest` in alignments alone, and
records that **nothing gated draw against hit test** the way CI gates GPU against
Canvas2D. Five features are converted and the conversion found a live
GPU/Canvas2D bug.

**Which mark, though — this level is blocked on Level 0.5.** The sentence above
cites ADR-090's `Mark` and the 3,335-line alignments measurement together; those
are two different abstractions and only one of them has ever derived a hit test.
The 3,335 lines belong to `plugins/alignments/src/features/mark.ts`, which
already does what this level proposes, for five features, using per-instance
geometry that reads pileup row offsets. ADR-090's `Mark` is a union of one shape
with a per-frame colour and cannot express any of them.

So the real question is not "derive hit from the mark" — alignments did that —
but **whether the thing that worked can move above the layout boundary at all.**
Answer Level 0.5 first.

**The move.** The channels already carry what a hit test needs — `x..x2` contains
a bp, `y` is above the cursor. Derive `hit` from the mark alongside the pass and
the painter, keeping the two gates separate (`alpha` for drawn, `hittable` for
significant) because collapsing them hands clicks back to the noise the frequency
threshold suppresses.

**Shape order is set by consumers, not completeness.** `point` first (Manhattan's
disc; the SDF is already in `pointGlyph.slang`, which has exactly one consumer
today), then `cell` — the biggest single win available, because **alignments
mismatches, MAF bases and variant-matrix genotypes are the same shape drawn three
times**, and `rowRect.slang` already serves MAF and multi-row. Then `span`,
`line`, `arc`, `tile`.

**Gauge.** A converted display's `hitTest.ts` file stops existing. The
draw-against-hit sweep that `gap` / `mismatch` / `softclipBases` already run
becomes generic.

**Deletes.** The third of three copies per feature, which is the copy with no
gate on it.

**Risk.** The shapes that already refused conversion (`insertion`, `coverage`,
`modification`) refuse for reasons recorded in the idea doc, and none of them is
a hit-test problem. Respect the boundary that doc found: `PileupMark` covers
per-instance marks on pileup rows, and a binned histogram over a worker-packed
buffer is a different mechanism.

---

### Level 4 — The band stack

**Today.** Every large display is already a stack of bands, and none of them says
so. Alignments = coverage + pileup + arcs (`sectionLayout.ts`,
`belowCoverageBandsGeometry`, `computeStackedSections`). MAF = coverage +
conservation + rows. Multi-sample variant = variant lane + genotype matrix. This
is the MAF↔alignments kinship exactly: **one shared band and one unshared one.**
The coverage half is already packaged (`render-core/coverageBand.ts` +
`packages/alignments-core`, since `f2effb9167`); the rows half is Level 2.

**The move — and it is narrower than it looks.**
[feature-band-consumers](../mechanisms/feature-band-consumers.md) already declined
generalizing the band allocators, correctly: `computeBandStack` is five lines,
sticky coverage and scrolling sections differ where they should. **Do not
overturn that.** What that doc has instead is seven rules, each independently
rediscovered by at least two plugins, and its own summary of the cost: "~400
lines of executable glue and ~500 lines of prose re-deriving the seven rules."

The move is to make **the contract** a type where the allocator stays a function.
A `Band` declares `reserve` / `paint` / `pick` / `active` off one member, so
"the reserver and the painter read one function" and "off spends 0 px" are
build failures rather than prose.

**Gauge.** A second band consumer costs the 400 lines of glue and none of the
500 lines of prose.

**Note what that gauge deletes: prose, not code.** The ~400 lines of glue stay by
construction — the doc's own position is that the allocators should not be
generalized. So this is the highest-risk level with the smallest measured code
win, which is the inverse of every other level here. That is not an argument
against it (re-derivation is a real cost, and a build failure beats a rule
readers must remember), but it should be taken *last* rather than on enthusiasm,
and it is the first level to cut if the plan needs shortening.

**Risk.** Highest of the five, and the one most likely to become a framework.
The kill condition is explicit: if the type cannot be written without a
registry, stop — a registry serving one display is
[ADR-050](../architecture-decision-records/adr-050-track-containers-are-not-view-types.md)'s
declined `trackContainer` again.

---

### Level 5 — One spec, three front-ends

**Today.** The jb2export CLI grammar, the URL params and the `displaySnapshot`
JSON are three dialects of one thing, which is why the screenshot corpus's `cli`
and `url` modes test different code paths.

**The move.** Once Level 1 lands this is mostly bookkeeping: lower the CLI
grammar onto the same channel table, and the drift is structurally gone. The
remaining items are in [session-spec-grammar](session-spec-grammar.md) — versioning
the format, reusable scale objects, no sentinels in the public form.

**Gauge.** `color:tag:HP` and the session JSON parse to the same object, and
`generateConfigDocs.ts` builds a spec-built display's config page off `params`
(the one page the score-example lost, per the five-primitives doc).

---

## Order, and where each level can be abandoned

Level 0 first and alone; it is the falsification step and everything above
assumes its result. **Level 2 is the only one that is genuinely parallel to it** —
it is about placement, not about the factory, and it stands whatever Level 0
returns.

The rest is a chain:

| Level | Depends on | Because |
| --- | --- | --- |
| 0 | — | falsification step |
| 2 | — | placement is independent of the factory |
| 0.5 | 0 | needs to know the factory holds a real display |
| 1 | 0, and supersedes ADR-090's colour ruling | extends the factory's own `ParamDefinition` |
| 3 | 0.5, then 1 | needs the mark question settled and per-instance channels to exist |
| 4 | 2 | the rows half of a band stack is placement |
| 5 | 1 | lowers the CLI grammar onto Level 1's table |

Every level is separately shippable and separately abandonable. If Level 0 comes
back negative, Level 2 still stands entirely on its own, and Level 1 survives in
its smaller form — the UI-derivation metadata is worth having on the four
hand-written model files even if no display ever moves onto the factory.

## What this must not become

Each of these has been declined already, on grounds that still hold:

- **A render graph, indirect draws, GPU-driven culling.** `GPU_RENDERING.md`
  §"What this architecture deliberately does not have", one specific reason each.
- **A transpiled draw stage.**
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  stands. Note the difference from genome-spy, which *generates* GLSL per
  encoding: hand-written per shape is the better trade here because one Slang
  source already feeds WGSL, GLSL and a lifted JS twin, and that is a claim worth
  keeping.
- **A band registry**, and **generalized band allocators**. See Level 4.
- **A mixin composed into `BaseDisplay`.**
  [ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md);
  shared policy at that level is a plain function.
- **A glyph extension point inside `LinearBasicDisplay`.**
  [ADR-036](../architecture-decision-records/adr-036-delete-stranded-pluggable-glyph-registry.md).
  The unit stays "a display", never "a glyph inside someone else's display".
- **Erasing the intentional backend divergences.** `WIGGLE_FUDGE_FACTOR`, the
  variant-matrix `f2`, synteny's stroke-vs-fill swap. Each is a property of the
  shape, which is what makes a shape library the right home for them.

## What each level lets the manuscript claim

The concept-bloat worry is a story worry, and the good version is already written
down in [mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md)
and not claimed:

> "Every display runs the same sequence. What differs between plugins is what a
> **row** means, what a **colour** means, and which extra decision sits inside one
> of these steps — not the shape of the sequence itself."

That is the thesis: **one fixed pipeline with a small number of pluggable
stages**, gate → tier → fetch → place → fit → draw → pick, where per-track-type
variation is confined to two nouns. Framed that way the concept count is not
growing — alignments, MAF and variants are three instantiations, not three
architectures — and the marks work becomes a consequence rather than the
headline.

Against that frame, each level converts a sentence from an assertion into a
measurement:

| Level | The claim it earns |
| --- | --- |
| 0 | the authoring surface holds a real display, not only a toy |
| 0.5 | one mark abstraction, and the boundary it stops at is named |
| 1 | encodings are orthogonal to track types, as in a grammar |
| 2 | reordering is a view operation, never a refetch — stated as a primitive |
| 3 | one declaration, three backends and a hit test that **cannot** silently disagree |
| 4 | a track is a composition of bands, and a band has a contract |
| 5 | one spec, three front-ends, no dialect drift |

**Level 1's row is conditional on the colour relitigation.** A declaration that
derives menus, legends and session keys but never reaches the render path does
not earn "encodings are orthogonal to track types, as in a grammar" — in a
grammar the encoding *is* what draws. With per-instance channel cardinality it
earns the row outright. Without it, the honest claim shrinks to "the UI surfaces
derive from one settings table", which is worth shipping and is not this
sentence. Do not write the grammar claim against the smaller version.

Level 3's row is the headline, and the defensible novelty against both vendored
comparisons: genome-spy is single-backend, gosling is single-backend, and neither
has a CI-gated cross-backend parity threshold
([CROSS_BACKEND_GATE](../reference/CROSS_BACKEND_GATE.md)). The honest limitation
to state rather than hide is the one at the top of this doc: **the grammar stops
at layout, on purpose, because genomic layout is data-dependent and
cross-region.**

## Ground this changes

Two of these are overruled outright and the rest re-taken. Describing all of
them as re-taken understates what Levels 1 and 3 need.

- **RFC-001 §2** — **contested, not narrowed.** §2's leading objection is
  "unmotivated at both ends", and it names Manhattan as the complex end that
  "needs the full mixin/RPC/render shape regardless". Level 0 is a direct test of
  that clause on §2's own example. §2 also counts "custom hit-testing" among what
  a grammar loses, which Level 3 proposes to derive. If both land, §2's non-goal
  is superseded rather than refined, and it should be rewritten to say so.
- **[ADR-090](../architecture-decision-records/adr-090-a-mark-is-a-shape-plus-its-channels.md)**
  — **its colour ruling should be superseded.** "A per-instance color channel...
  is a second shape variant rather than an option on this one" describes `bar`
  and nothing else in the tree: `rowRect.slang` carries a per-instance ABGR lane
  and `arc.slang` a per-instance palette index, each as one shape. Constant-versus-field
  is channel cardinality, not shape identity, and treating it as shape identity
  multiplies the shape list over an orthogonal axis. The rest of ADR-090 stands,
  including "the next shape joins on a consumer's pull" — Level 0 names the
  consumer and Level 3 says which shape.
- **`a-track-type-is-five-primitives`** (rejected with the factory, [ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)) scoped
  the ABI to what the score-example has and puts alignments out of scope. That
  scoping is right for the *published contract* and wrong as the measure of
  whether the system got simpler; this doc is the second measure, not a
  replacement for the first.
- **[feature-band-consumers](../mechanisms/feature-band-consumers.md)** declines
  generalizing the allocators. Level 4 keeps that and takes only the contract.
