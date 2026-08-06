---
name: screenshot-callout-anchoring
description: 87 screenshot callouts across 38 specs still name raw viewport pixels instead of anchoring — the audit that found them, which tiers are worth converting and in what order, the resolution math to replay before rendering anything, and the two categories to leave alone. Read with website/CLAUDE.md's Screenshots section.
---

# Screenshot callouts still naming raw viewport pixels

`website/CLAUDE.md` states the rule twice — "never hand-measure a callout
position — every annotation `anchor`s" and "a click anchors too" — and the
codebase does not yet keep it. Audited 2026-08-06: **87 raw-pixel callouts and
actions across 38 specs.**

```
51  annotation x/y      a text pill or box placed at a point
16  arrow  from         tail raw, head anchored
 4  arrow  from + to    the whole arrow raw
16  action from         a click / rightclick / hover on a bare coordinate
```

The cost is on the record. `alignments_sort_by_base` kept a 108bp-era
right-click coordinate after its spec was narrowed to 31bp and read as 17%
render flakiness for months; `locusAnchor.ts`'s header comment is the writeup.
`sv_cgiab/deletion_sv_inspector_search` kept a raised `diffThreshold` — and so a
stale figure — specifically because nobody could lower it while its callouts
were hand-placed.

**One figure is converted and is the worked example** — that spec, in
`website/scripts/specs/sv.ts` (`3dbdaa1c08`, `acb06ef36a`). It measures 0.000%
run-to-run afterwards. Read its annotations block before starting any of the
below; it is shorter than this file.

## Reproducing the audit

I wrote the script twice in one session, which is the argument for promoting it
into `website/scripts/check-specs.ts` (which already imports `validateSpecs()`
and runs in CI) as a **ratchet on the count** rather than a hard failure — 87 is
too many to gate on today, and a ratchet is what stops number 88. That is a real
recommendation, not an aside.

Until then: import `specs` from `screenshot-specs.ts`, walk `spec.annotations`
and every `spec.stages[].annotations`, and flag any entry with `x`/`y` and no
`anchor`, any `from` with no `fromAnchor`, any `to` with no `anchor`. Same walk
over `spec.actions` / `stages[].actions` for `from` with no `anchor` (skip
`type: 'drag'` — a rubberband genuinely is two viewport points).

## Take them in this order

### 1. The ~10 targeted raw-coordinate actions — highest risk, smallest diff

A misplaced label is visible in review. A misplaced click is not: it lands on a
different feature, opens a different menu, and the figure is *wrong* rather than
ugly — or it lands intermittently, depending on how the pileup packed that run.

```
multisv, multisv_svtype, multisv_rhd          ui.ts     rightclick into a multi-sample matrix
read_vs_ref_insertion                         ui.ts     rightclick a read
linear_align_ctx_menu                         alignments.ts
customized_feature_details                    features.ts
upstream_downstream_details                   features.ts
gene_track_color_by_cds                       features.ts
genomes_synteny/launch_sequence               synteny.ts  rightclick a chain block
maf_codon_tooltip                             maf.ts      hover
```

`multisv` is the clearest: `{ type: 'rightclick', from: { x: 1130, y: 450 } }`,
commented "y=450 lands in the multi-sample matrix (proven coordinate)", gating a
`waitForText: 'Sort by genotype'` the figure depends on. Proven when it was
measured, and nothing says when that stops being true. These take
`anchor: { track, locus, fracY }` — the exact case `locusAnchor.ts` exists for.

**The other 6 are `dismissMenus()`** (`{ type: 'click', from: { x: 550, y: 58 } }`
twice, at the view title bar) in `feature_height_default` ×4 and
`display_type_default_badge` ×2. That one clicks *nothing on purpose* and is
already centralized in one helper. **Leave it.**

### 2. `crossoverHighlights` — 16 callouts, one helper, two figures

`trio-crossover-paternal` / `trio-crossover-maternal` (`specs/trio.ts`) build
every callout from constants in `screenshot-spec-helpers.ts`:

```ts
TRIO_VCF_ROW_TOP = 268     TRIO_PAINT_TOP = 193
TRIO_XOVER_X    = 750      rightW = 1495 - TRIO_XOVER_X
```

Best ratio in the audit: one helper, sixteen callouts, and the semantics are
*already named* — the y comes from `trioRowY(label)` keyed on a haplotype row
name, and the x is the crossover, which the spec's own prose gives as
`chr1:29,697,418` and `chr1:55,753,613` (750 is just "centre of a 400 kb
window"). So:

- **x is a locus.** The two frame widths are window-start→crossover and
  crossover→window-end; both are loci, so neither width needs writing down.
- **y is a row index, and `AnnotationAnchor` has no row concept.** `fracY` is
  the closest thing: the row arithmetic survives but becomes a fraction of the
  track band instead of an absolute viewport y. That is the whole win —
  `TRIO_VCF_ROW_TOP = 268` is what breaks when anything above the track moves.
- The 3px and 1495px edges become the track band's own left/right.

Note the existing comment that the true pitch is `height/rows ≈ 43.33`, not a
round 44 — a rounded pitch drifted the frames ~3px low by the bottom row. Keep
that arithmetic; only its origin changes.

Same treatment, two callouts, no helper: `gc_content` (`specs/bigwig.ts`) parks
"Mostly positive skew (leading strand)" at (150, 430) and its negative twin at
(930, 555). Those name **regions of the wiggle**, not the figure, so each is a
locus anchor with a `fracY` into the track. Small, and a good first conversion
for anyone who has not done one.

### 3. `lgv_usage_guide` — 12, purely mechanical

The labelled-UI-diagram figure in `specs/ui.ts`. Arrow **heads** already anchor
(`selector: 'button[title="Open track selector"]'` and friends); the pills and
the tails are, by its own comment, "absolute viewport CSS px (1500x800 capture)
tuned to the live control positions". Each pill anchors to the same control its
arrow already names, with `alignY: 'top'` and a negative `dy` to lift it into
the clear strip; each tail becomes a `fromAnchor` on that pill's control. No
measurement needed beyond the lift, and the figure's design ("labels in the
clear band next to the control, short arrows") is preserved exactly.

**All 16 `arrow from` entries are this same shape** — head anchored, tail hand-
placed — so they all convert the same way, whatever figure they are in:
`multiwig/addtrack`, `multiway_synteny/ecoli_*`, `add_track_form`,
`drawer_widget_toggle`, `variant_panel`, `inverted_duplication`,
`link_to_split_view`. `bookmark_widget_edit_label`, `linear_align_ctx_menu`,
`trio-crossover-*` are `from + to`, i.e. no anchor at either end; those need the
head resolved first.

### 4. The long tail — corner captions, and probably not a task

What is left is a caption pill parked in a corner or a margin:
`genomes_synteny/ribbons_default` ("Straight ribbons, colored indels"),
`mcscan_synteny/anchors`, `rnaseq/strand_specific_*`,
`horizontally_flip_before` / `_after`, `cancer_sv/k562_fusion_circle_*`,
`sv_cgiab/translocation_sv_inspector_view`, and the per-stage narration of
`genomes_synteny/launch_sequence` and `multiwig/trackselector`. These do not
*point* at anything, so the failure the rule guards against does not apply, and
anchoring them relocates them — `translocation_sv_inspector_view`'s caption sits
at (60, 90) while the only thing it names, the `SV_20` row, is most of the view
further down.

Don't convert these to satisfy the count. If one is worth touching it is because
it *collides* with content (that same caption covers the spreadsheet's header
row and its first two rows), and that is a composition fix, not an anchoring one.

## What not to re-derive: the method

Converting one figure blind and rendering to see what happened is the slow way,
and on a shared box a render is not always available. This worked:

1. **Measure the committed PNG**, not the source. Captures are
   `deviceScaleFactor: 2`, so halve everything. `python3` + PIL, scanning for
   the glyph's colour or the drawn box's red, gives element rects in CSS px in
   about a minute — that is where `track top = 710.5`, `glyph x 602–694.5`,
   `labels to y 772` came from for the SV figure.
2. **Replay `drawAnnotationOverlay`'s `resolved` map by hand** before writing
   the anchor. Three things there are not obvious from the types:
   - the **anchor's** `dx`/`dy` and the **annotation's own** `dx`/`dy` both
     apply, at different stages — the anchor's shifts the rect before
     `alignX`/`alignY` are read off it.
   - `alignX`/`alignY` are **ignored on `fromAnchor`**. A tail is always the
     rect's centre plus `dx`/`dy`; that is the only way to move it.
   - a `box` whose anchor sets `fracY` gets a **zero-height band**, so
     `height` falls back to `2 * pad` = 12px. Supply `height` explicitly.
     Omitting `fracY` instead wraps the whole track band — right for a short
     track, wrong for a 130px display holding a 10px glyph.
3. **Draw the predicted geometry over the committed PNG and look at it.** Ten
   lines of PIL. Catches an off-by-a-row before it costs a render.
4. **Verify with `--check`**, which renders twice and touches no committed file:
   `node --experimental-strip-types scripts/generate-screenshots.ts --check
   --filter <spec> --exact --localport 3355`. `drawAnnotations` throws on any
   anchor that resolves to nothing, so a clean run *is* the proof every anchor
   resolved. **Pass `--localport`** — another agent's run holds the default
   3334, and the collision surfaces as a blank page and a ready-gate timeout
   before it surfaces as `EADDRINUSE`.

One trick worth stealing rather than re-inventing: `parseAnnotationLocus`
accepts `..` as well as `-`, so a location string printed by the UI
(`chr10:122,835,344..122,837,142`) works **both** as a `text` anchor finding
that cell in the DOM and as a `locus` resolving to the feature's pixels. The SV
figure's five callouts collapse onto one constant that way, and the callout on
the row and the callout on the glyph cannot drift apart.

## Don't regenerate figures to prove a conversion

The worktree usually carries another agent's in-flight display edits, and
`products/jbrowse-web/build/` is whatever they last built. A figure rendered
under that bakes their unlanded work into a committed PNG — which is how the SV
figure's raised `diffThreshold` got justified with a contaminated 4.95%
measurement in the first place. Land the spec change, let the weekly sweep
render it on a clean runner, and say so in the commit.
