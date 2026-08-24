---
name: a-display-declares-itself
description: An ambitious multi-level simplification target, written against the measured census rather than against the render path. A display today IS its 288 getters, and five surfaces are hand-written against them nineteen times over — menus, legends, hit tests, renderer pairs and the session spelling. The move is to make the declaration the source of truth and derive the five; the levels, the gauge each is falsified by, the boundary where the grammar deliberately stops, and what each level lets the manuscript claim. Read before proposing a grammar layer, before generalizing a band, and before taking defineDisplay further on the score-example.
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
2026-08-24.

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

This restates RFC-001 §2's non-goal ("no glyph-registration / spec-grammar / DSL
layer") on narrower ground rather than overruling it. §2's objection was that a
grammar "would replace only the render-callback layer" — correct, and the reason
to aim it somewhere else.

## The levels

Named rather than numbered, because only the dependency order below is fixed.

---

### Level 0 — Re-gauge the factory on a display that is hard

**Today.** `defineDisplay` is measured against the easy case, and
[a-track-type-is-five-primitives](a-track-type-is-five-primitives.md) says in so
many words that alignments "stays on the full stack and is not a target". Every
level below assumes the factory can hold a real display. Nothing has tested that.

**The move.** Port `LinearManhattanDisplay` (2,180 lines, 24 files, 6 slots, 3
properties, 0 volatiles) to `defineDisplay`. It is the smallest display that has
all of: a real scale, a real hit test, a legend, a tooltip, a hand-written
shader, and a `renderSvg`. The todo
[put-the-manhattan-display-on-plotgeometry](../todo/put-the-manhattan-display-on-plotgeometry.md)
is the same complaint arriving from the wiggle side.

**Gauge.** Under 400 lines, no renderer class, no `rpcProps`/`gpuProps` split
written by hand, tooltip and legend intact, `renderSvg` unchanged in output.

**Falsifies.** If Manhattan does not fit, the imperative altitude is the real
contract and the levels below shrink to Level 1 and Level 2 only. **Find this out
before writing another shape.**

---

### Level 1 — The channel, and the scale

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

**Gauge.** `plugins/variants/src/shared/multiSampleVariantMenuItems.ts` (401
lines, 18 hand-written labels) becomes a declaration plus its resolver. The
legend files for that display disappear rather than shrink.

**Deletes.** The reducible half of 6,822 lines of plugin menu code and 4,058
lines of legend, and it closes the first and largest item in
[session-spec-grammar](session-spec-grammar.md).

**Risk.** A channel table that has to express alignments' colour ladder is the
failure mode. Guard by porting alignments' declaration *without* its resolver
first; if the declaration cannot be written in isolation, the split is wrong.

---

### Level 2 — Name the placement

**Today.** Five implementations, and two of them are the same paragraph. Read
the doc comments on `maf/LinearMafDisplay/placeMafRows.ts` and
`variants/shared/placeVariantRows.ts` side by side:

> "The worker names rows by species and knows nothing about display order, so
> this is where a fetched row becomes a *placed* row... It is also what lets a
> reorder re-place cached data instead of refetching it."

**The move.** `place(payload, ordering) → rowIndex[]`, carrying the invariant
**a reorder re-places, never refetches** as a type rather than a doc comment.
Two flavours, both already in tree:

- **Projection** — a name maps to a row. MAF species, variant samples, wiggle
  sources, multi-row groups. Four displays, four copies.
- **Packing** — an interval finds a free row. `GranularRectLayout` (canvas) and
  `sortLayout`'s `placeRectCapped` (alignments). Two displays, two copies, and
  alignments' adds a cross-region sort anchor that the shared one would have to
  take as a parameter.

**Gauge.** The four projection sites collapse to one call plus a key function.
`ARCHITECTURE.md`'s "Row order is not a fetch input" section becomes a property
of the primitive instead of a rule readers have to remember.

**Then the clustering follows for free.** `packages/tree-sidebar` is 6,043 shared
lines and each plugin's adapter is already thin (62–121 lines: `runWiggleClustering`,
`applyClusterOrder`, `runMultiRowClustering`, `runGenotypeClustering`,
`runMafClustering`). That is the pattern this whole plan is copying — a shared
mechanism plus a per-plugin "what is the matrix" function — and it works today.
Placement is the missing half of it: clustering produces an ordering, and
`place` is what consumes one.

**Risk.** Low. This is the level with the best evidence and the least design
left in it, and it is the one with no equivalent in any grammar system, which
makes it the better contribution of the two.

---

### Level 3 — Hit derives from the mark

**Today.** ADR-090 closes with "Hit testing does not derive yet." Twenty-one
files are named for hit testing or picking;
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) measured
3,335 lines across `packGpu`/`drawCanvas`/`hitTest` in alignments alone, and
records that **nothing gated draw against hit test** the way CI gates GPU against
Canvas2D. Five features are converted and the conversion found a live
GPU/Canvas2D bug.

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
assumes its result. Then Level 1 and Level 2 in parallel — they touch different
files and neither depends on the other. Level 3 needs Level 0's answer. Level 4
needs Level 2. Level 5 needs Level 1.

Every level is separately shippable and separately abandonable. If Level 0 comes
back negative, Levels 1 and 2 still stand on their own — they are about the
declaration and the placement, not about the factory.

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
| 1 | encodings are orthogonal to track types, as in a grammar |
| 2 | reordering is a view operation, never a refetch — stated as a primitive |
| 3 | one declaration, three backends and a hit test that **cannot** silently disagree |
| 4 | a track is a composition of bands, and a band has a contract |
| 5 | one spec, three front-ends, no dialect drift |

Level 3's row is the headline, and the defensible novelty against both vendored
comparisons: genome-spy is single-backend, gosling is single-backend, and neither
has a CI-gated cross-backend parity threshold
([CROSS_BACKEND_GATE](../reference/CROSS_BACKEND_GATE.md)). The honest limitation
to state rather than hide is the one at the top of this doc: **the grammar stops
at layout, on purpose, because genomic layout is data-dependent and
cross-region.**

## Ground this changes

Re-taken, not overruled, and each on a premise this plan moves:

- **RFC-001 §2** ruled out a spec grammar because it would replace only the
  render-callback layer. This aims it at the declaration layer instead, and keeps
  §2's verdict for the render layer.
- **[ADR-090](../architecture-decision-records/adr-090-a-mark-is-a-shape-plus-its-channels.md)**
  says the next shape joins on a consumer's pull. Level 0 names the consumer, and
  Level 3 says which shape.
- **[a-track-type-is-five-primitives](a-track-type-is-five-primitives.md)** scopes
  the ABI to what the score-example has and puts alignments out of scope. That
  scoping is right for the *published contract* and wrong as the measure of
  whether the system got simpler; this doc is the second measure, not a
  replacement for the first.
- **[feature-band-consumers](../mechanisms/feature-band-consumers.md)** declines
  generalizing the allocators. Level 4 keeps that and takes only the contract.
