---
name: split-the-point-mark-into-a-centred-point-and-a-rule
description: pointMark.slang draws a point as a horizontal bar whenever x2 - x is wider than its glyph, so every shipped point config over a BED writes x2 "start" to get a dot. Split it the Vega-Lite way - a point stands at the centre of [x, x2] and never widens, and a new rule mark crosses the extent - with one shape serving both through a uniform, retiring the per-instance pointDrawsBar branch.
---

# Split the point mark into a centred point and a rule

`pointMark.slang` draws a point as a horizontal bar whenever `x2 - x` is wider
than its glyph (`pointDrawsBar`), so a `point` over any interval feature draws
as a dash, and every shipped point config over a BED writes `x2: "start"` to
get a dot: `test_data/volvox/config_marks.json`,
`website/docs/tutorials/read_marks.md`,
`website/docs/config_guides/mark_display_examples.md` and its spec, and the
`mark_display.md` sentence explaining the workaround. The glyph also stands at
`x`, not the interval's centre, where a text mark centres its label.

**The Vega-Lite word is `rule`, not `tick`**: its `tick` is a short line of
fixed length with no `x2`, and a `rule` with `x`, `x2` and `y` is the
horizontal segment (ggplot2's `geom_segment`). So a `point` stands at the
centre of `[x, x2]` and never widens, and a `rule` crosses the extent, `size`
px thick, at least a pixel wide. One shape serves both through a uniform, which
retires the per-instance branch and its three readers (vertex stage, painter
fork, hit fork) and the `pointDrawsBar` js-export.

## The work

- `MARK_TYPES` gains `rule` (`markVocabulary.ts`, mirrored in the CLI
  validator's copy under
  `products/jbrowse-cli/src/commands/validate/markRules/`), `markList.ts` binds
  it to the point shape, and `markProblems.ts`'s size rule admits it.
- The vocabulary table in `mark_display.md` gets a row, and the `x2: "start"`
  workarounds go.
- `dog10k.ts`'s Fst windows and any BigWig tier min/max plot become `rule` to
  keep their pictures, and the points figures
  (`mark_display_examples/points`, read_marks) are re-shot. The `mark-display`
  browser suite's goldens move with it; CI reports them and they are fixed
  forward.
- Write it as an ADR.

A VCF strip mixing SNPs and SVs in one point mark loses its per-instance dash,
which is the case the branch was written for; no shipped config draws one.
