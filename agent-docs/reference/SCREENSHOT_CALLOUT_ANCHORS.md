---
name: screenshot-callout-anchors
description: How a screenshot callout or a driven click resolves its position at capture time, the four things about that resolution the types don't tell you, and how to convert a hand-placed coordinate into an anchor by measuring the committed PNG instead of re-rendering. Read before placing a callout, converting one, or diagnosing a figure whose annotation landed in the top-left corner.
---

# Anchoring a screenshot callout

`website/CLAUDE.md` states the rule: **never hand-measure a callout position —
every annotation `anchor`s, and a click anchors too.** This is the how, and the
arithmetic you would otherwise re-derive with a render.

The vocabulary is `AnnotationAnchor` in
`packages/browser-test-utils/src/annotationOverlay.ts`, shared with the desktop
selenium harness. Four kinds, in decreasing order of preference: `track`+`locus`
(the live LGV model), `graphNode` (a GFA segment), `selector`, `text`. Actions
take the same shape through `website/scripts/locusAnchor.ts`, whose header is
the writeup of what a stale coordinate cost — `alignments_sort_by_base` kept a
108bp-era right-click after its spec narrowed to 31bp and read as 17% render
flakiness for months.

`website/scripts/check-specs.ts` ratchets the count of what is left. The residue is
deliberate; its comment says which kinds and why.

## What the types don't say

Four things, all of which produce a plausible-looking figure rather than an
error:

- **The anchor's `dx`/`dy` and the annotation's own `dx`/`dy` both apply, at
  different stages.** The anchor's shifts the resolved rect *before* `alignX` /
  `alignY` are read off it; the annotation's shifts the point afterwards. For a
  point anchor they are equivalent, which is why the difference goes unnoticed
  until an `alignX: 'right'` is involved.
- **A `fromAnchor` is read exactly like an `anchor`**, `alignX`/`alignY`
  included, so an arrow's two ends align the same way and a tail can sit at an
  element's edge. It did NOT used to: align was applied to the head and dropped
  on the tail, which put the tail at the rect's centre while the spec said edge.
  Silent in every case and loudest on a wide rect —
  `tcga/mutations_cdh1_histology` asked for a short vertical arrow at a track's
  left edge and drew a diagonal across the whole panel, half a view width off.
  A tail leaving one of our own text pills is still not this: use `leader`.
  Note the anchor's own `dx`/`dy` shift the rect *before* the align is read off
  it, at both ends, so a spec that encodes half an element's width as a `dx`
  (what this used to advise) must drop that `dx` when it adopts an align.
- **A `box` whose anchor sets `fracY` gets a zero-height band**, so `height`
  falls back to `2 * pad` (12px). Supply `height` explicitly. Omitting `fracY`
  instead wraps the whole track band — right for a short track, wrong for a
  130px display holding a 10px glyph.
- **`pad` insets a box on every side** (default 6), and `width`/`height` given
  explicitly are used verbatim while `x`/`y` still get the `pad`. Frames that
  have to meet a row exactly, or meet each other at a breakpoint, want `pad: 0`.

## A label that points at something is ONE annotation

`leader: true` on a `text` annotation draws the label's arrow with it. The
anchor is then what the callout NAMES, and the annotation's own `dx`/`dy` place
the label off it: `dx`'s sign picks the side, its magnitude is the gap between
the target and the pill's facing edge, and `dy` centres the pill on that line.
The tail comes off the measured pill, so nothing about it is written down.

Two annotations cannot do this, and the reason is not fixable by better
numbers. A tail belongs at the pill's edge; a pill's width is only known once
its text is measured in the page; so a spec can only guess it, and one guess
fits one label length. `dog10k-size-fst-scan-genome` named three peaks with one
pair of offsets and got three different gaps — IGF1's arrow stopped 50px short
of its pill and IGF2BP2's tail vanished inside one — while `ld/lct_fst_scan`'s
three-letter label floated on its own. Both came back from review as "the
arrows are no longer next to the text boxes". `oat_homoeologs` was the same
defect a third time, found by counting the pattern rather than by a reviewer.

A `leader` whose pill covers its own target draws no arrow and reports a miss,
so the fix (raise `dx`) surfaces as a thrown error rather than as a figure with
a label and no arrow in it.

**`countDetachableLabels` ratchets the rest** (`screenshot-spec-rules.ts`,
run by `check-specs`), pairing a `text` with an `arrow` whose `fromAnchor`
resolves to the same site. That is authorship rather than proximity, so it
cannot fire on an arrow that legitimately starts in open space. Converting one
moves pixels, so they land as their figures are touched; lower `LEADER_BASELINE`
when one does.

Only the SIDEWAYS ones are fragile, which is worth knowing before spending a
regen on a figure that reads fine. Horizontal is the axis whose extent only the
page knows, so a pill whose arrow leaves through a horizontal edge — every one
of `lgv_usage_guide`'s toolbar callouts — sits where it was put. The sideways
ones that look right today are right by coincidence, and go wrong on the next
edit to a label or a font size.

One trick worth reusing: `parseAnnotationLocus` accepts `..` as well as `-`, so
a location string printed by the UI (`chr10:122,835,344..122,837,142`) works
**both** as a `text` anchor finding that cell in the DOM and as a `locus`
resolving to the feature's pixels. `sv_cgiab/deletion_sv_inspector_search`
collapses five callouts onto one constant that way, and the callout on the row
and the callout on the glyph then cannot drift apart.

## Converting a hand-placed coordinate without rendering

Rendering to see what happened is slow, and on a shared box a render bakes in
whatever another agent last built. Everything below comes off the committed PNG.

**Halve everything.** Captures are `deviceScaleFactor: 2`. A `stageColumns`
grid also gives each panel a 12px white border (`GRID_GUTTER_PX / 2`) in
captured pixels, so a stage's own (0,0) is at composed pixel (12,12); vertical
stacks abut with no border.

**x is a locus, and the mapping is exact.** The LGV's tracks container spans the
capture width with its left edge at 0, so `locus = windowStart + x *
(windowBp / viewportWidth)`. Verified three ways: `multisv`'s inversion band
edges, `maf_codon_tooltip`'s tooltip printing the codon its hover landed on
(`chrI:2,999,247`, from x=351 in a 1250px capture), and `linear_align_ctx_menu`'s
ruler ticks.

**y is a depth into a track, and the track's top is findable.** Track labels are
**in flow by default** — `LinearGenomeViewPlugin`'s `trackLabels` slot defaults
to `offset`, and `TrackContainer`'s `trackLabelOffset` adds `marginBottom: 4` —
so the label chip pushes the content down and the rendering container starts at
the chip's bottom edge plus 4. In a default 1500px-wide capture that puts the
**first track's rendering container at y = 193**, which four unrelated figures
agree on. Cross-check it against the display: an alignments track's coverage
band is exactly `coverageHeight` (45 by default) from the container top to the
first read row.

Prefer `fracY: 0` plus a `dy` over a bare fraction whenever the display packs
from its top (a pileup, a feature layout): 57px is the second read row whatever
height the display is given, where a fraction is that row at one height only.
Use a fraction when the rows genuinely divide the height (the trio VCF's six
haplotype rows) or when the callout should stay proportional.

**A committed figure already records what its anchors resolved to.** Two
readings, both exact:

- An **anchored arrowhead's tip is its element's centre**, because the marker is
  placed base-first at the shortened line end and extends `ARROW_LEN *
  strokeWidth` forward to the target. Ray-cast out of the known raw tail, keep
  the longest run of callout red (`#e3242b`), and the far end is the anchor
  point. That is how `lgv_usage_guide`'s six toolbar controls were placed — all
  five in the toolbar tier came back at y=121.4, which is its own proof the
  reading is sound.
- A **`box` annotation's painted rectangle is its element's rect**, inset by
  `pad + strokeWidth/2` on each side. The inset is symmetric, so the box's
  centre *is* the element's centre with no arithmetic at all.

**Then draw the predicted geometry over the committed PNG and look at it.** Ten
lines of PIL. Catches an off-by-a-row before it costs a render.

## When not to anchor

Two cases, and converting them to satisfy a count makes the figure worse:

- **A caption parked in a corner or a margin.** It points at nothing, so the
  failure anchoring prevents — a callout landing off its target — cannot happen
  to it, and anchoring *relocates* it: `sv_cgiab/translocation_sv_inspector_view`
  puts its caption at (60,90) while the `SV_20` row it names is most of a view
  further down. If one is worth touching it is because it collides with content,
  and that is a composition fix.
- **The tail of an arrow leaving one of those captions.** The caption and its
  tail are one unit in page coordinates. Anchoring only the tail pulls the arrow
  off the pill it leaves the first time a layout moves, which is worse than
  either end being raw. Both or neither — and "both" means anchoring the pill to
  the panel it sits over, the way `inverted_duplication`'s three callouts hang
  off their pileup track's top edge. Where the whole callout can anchor to what
  it names, `leader` makes the question moot.

## Verifying

`node --experimental-strip-types website/scripts/generate-screenshots.ts --check
--filter <spec> --exact --localport 3355`, which renders twice and touches no
committed file. `drawAnnotations` throws on any anchor that resolves to nothing
and an action anchor fails the spec by name, so a clean run *is* the proof every
anchor resolved; the percentage is the run-to-run drift.

**Pass `--localport`** — another agent's run holds the default 3334, and the
collision surfaces as a blank page and a ready-gate timeout long before it
surfaces as `EADDRINUSE`.

**A clean run does NOT prove the callout is in the picture.** `drawAnnotations`
only reports an anchor that resolved to *nothing*; one that resolves and then
draws off-frame is silent. `pangenome/rgfa_hover_sync` carried the pill that
answered its review note for a whole round, anchored `dy: +90` off a node the
force layout puts at the foot of a 1250px capture — so it painted at y≈1299 and
no reviewer ever saw it. When a callout hangs off content whose position the
layout chooses, check the drawn y against the capture height rather than
trusting the run.

Don't regenerate the figure to prove the conversion. The worktree usually
carries another agent's in-flight display edits and `products/jbrowse-web`'s
build output is whatever they last built; a figure rendered under that bakes their unlanded
work into a committed PNG. Land the spec change and let the weekly sweep render
it on a clean runner.
