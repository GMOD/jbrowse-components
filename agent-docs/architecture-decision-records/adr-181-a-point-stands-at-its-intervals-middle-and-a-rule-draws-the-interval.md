---
status: Accepted
summary: "A `point` mark stands at the middle of its `x`..`x2` and never widens; the new `rule` mark is the line across that extent at `y`, `size` px thick, Vega-Lite's `rule` with `x`, `x2` and `y`. `pointMark.slang` drew a point as a dash wherever its extent outran the glyph (`pointDrawsBar`), which every shipped point config over a BED undid with `x2: \"start\"`. render-core gains `ruleMark`, drawn through the point shader under a `rule` uniform, a box shape with `ink` and no `hitNearest`; `pointDrawsBar` and its three readers go. The configs that drew windows as dashes (dog10k's 20 kb Fst lane, the windowed Manhattan fixture) write `rule`, and the SV-GWAS demo layers a thin rule under its points"
---

# ADR-181: A point stands at its interval's middle, and a rule draws the interval

## Status

Accepted (2026-09-27). The 2026-09-26 evening grammar scan's handoff ranked
it first among the vocabulary fixes left after ADR-179; it was built when
Colin asked for the scan's work to continue.

## Context

`pointMark.slang` placed a point's glyph at `x`, and drew the instance as a
bar of the glyph's height from `x` to `x2` wherever that span was wider than
the glyph. Three places read that decision (the vertex stage, the Canvas2D
painter and the hit test), so the shader exported it as `pointDrawsBar`.

The rule was per instance so that one point mark could hold SNPs and
structural variants together. What it did to everything else:

- A `point` over any interval feature drew as a dash once the view zoomed in,
  so every shipped point config over a BED wrote `x2: "start"` to get a dot
  (the examples page, the volvox fixture, the read_marks demo, its build
  script and its tutorial), and the guide spent a sentence explaining the
  workaround.
- The glyph stood at `x`, where a `text` mark centres its label on the
  middle of `x`..`x2`, so a label and a point over one feature disagreed by
  half its length.
- A point meant as a dot turned into a dash at some zooms: the read_marks
  insert-size figure, captioned "a point per pair", showed dashes.

No grammar has this rule. Vega-Lite's `tick` is a short line of fixed length
with no `x2`, and its `rule` with `x`, `x2` and `y` is the horizontal segment,
ggplot2's `geom_segment`.

## Decision

- **A `point` stands at the middle of `[x, x2]`** and never widens. A SNP's
  glyph moves half a base right; a point over a gene sits over the gene's
  middle, under its label.
- **A `rule` mark draws the interval**: a line from `x` to `x2` at `y`, `size`
  px thick, widened to the display's `minWidthPx` from its `x` end as bar and
  span are. It reads `y`, `row` and `color`, takes no `shape`, and its `size`
  defaults to the point's diameter, so a config that swaps `point` for `rule`
  keeps the dash it drew before.
- **render-core's `ruleMark` draws through the point shader.** A `rule`
  uniform selects the bar branch for the whole pass, so the shader keeps one
  quad and one uniform block for both marks. On the CPU side `ruleMark` is a
  box shape with `ink` and no `hitNearest`, placing each instance through one
  `placeRule` over a per-block frame, as `spanMark` does; `pointMark` keeps
  its nearest-centre hit test. `pointDrawsBar` and its three readers go.
- **The inset follows what is drawn**: a rule-only plot stands in by half the
  thickest rule, where a point needs `pointInsetPx` (the diamond's reach); the
  hover ring covers a rule as it does a point.
- **Configs keep their pictures where the dash was the picture.** dog10k's
  20 kb Fst lane and the windowed Manhattan fixture (`gwas-manhattan-bars`)
  write `rule`. The SV-GWAS demo, whose README promised DELs and DUPs as bars
  while its default zoom drew nearly every one as a disc, layers a 2 px rule
  under its points, so every SV shows at the chromosome zoom and its extent
  shows zoomed in. The `x2: "start"` workarounds go.

## Consequences

- `MARK_TYPES` gains `rule`, and `jbrowse validate`'s generated copy with it;
  the `unread-size` rule admits a rule's `size`.
- Figures that change: `mark_display_examples/points` and the read_marks
  `insert_size` and `chromosome` figures (dots at the middle instead of dashes
  or leftmost reads), dog10k's size scan (the inset shrinks by 1.8 px). The
  `mark-display` and `gwas` browser goldens move with them, CI reports them,
  and they are fixed forward.
- A config that relied on the per-instance dash draws dots. The only shipped
  one, SV-GWAS, now says what it wants in two marks; a VCF strip mixing SNPs
  and SVs does the same.

## Rejected alternatives

- **`tick` as the name**, as the evening handoff first wrote it. Vega-Lite's
  `tick` is a fixed-length line with no `x2`; the segment across an interval
  is its `rule`.
- **One MarkShape with a `rule` param.** The painter, the ink and the hit test
  would each fork on it, which is the three-reader branch this ADR removes,
  moved from per instance to per pass.
- **Keeping the per-instance dash beside the new mark.** It is the only
  behaviour a reader cannot predict from the config, and the grammar already
  says "dot and extent" as two layers.
