---
name: grammar-scan-2026-09-26-evening
description: What the 2026-09-26 evening grammar scan left open after ADR-179 (domainQuantile) landed - the point mark's dash-by-default rule, which every shipped point config works around with x2 "start", to be split into a centred point and a Vega-Lite rule, and three low domainQuantile items the re-run review left. Read before touching the point shape or the mark vocabulary.
---

# Grammar scan, 2026-09-26 evening

The session ran out of tokens after landing [ADR-179](../architecture-decision-records/adr-179-an-open-scale-end-follows-one-quantile.md);
the review it left running was re-run later that day and its findings fixed.
**Delete this file once the item below is done.**

## Next

1. **The point mark's dash rule is the next vocabulary fix.** `pointMark.slang`
   draws a point as a horizontal bar whenever `x2 - x` is wider than its glyph
   (`pointDrawsBar`), so a `point` over any interval feature draws as a dash,
   and every shipped point config over a BED writes `x2: "start"` to get a dot:
   `test_data/volvox/config_marks.json`, `website/docs/tutorials/read_marks.md`,
   `website/docs/config_guides/mark_display_examples.md` and its spec, and the
   `mark_display.md` sentence explaining the workaround. The glyph also stands
   at `x`, not the interval's centre, where a text mark centres its label.
   **The Vega-Lite word is `rule`, not `tick`**: its `tick` is a short line of
   fixed length with no `x2`, and a `rule` with `x`, `x2` and `y` is the
   horizontal segment (ggplot2's `geom_segment`). So a `point` stands at the
   centre of `[x, x2]` and never widens, and a `rule` crosses the extent,
   `size` px thick, at least a pixel wide. One shape serves both through a
   uniform, which retires the per-instance branch and its three readers
   (vertex stage, painter fork, hit fork) and the `pointDrawsBar` js-export.
   Then: `MARK_TYPES` gains `rule` (`markVocabulary.ts`, mirrored in the CLI
   validator's copy under
   `products/jbrowse-cli/src/commands/validate/markRules/`), `markList.ts`
   binds it to the point shape, `markProblems.ts`'s size rule admits it, the
   vocabulary table in `mark_display.md` gets a row, the `x2: "start"`
   workarounds go, `dog10k.ts`'s Fst windows and any BigWig tier min/max plot
   become `rule` to keep their pictures, and the points figures
   (`mark_display_examples/points`, read_marks) are re-shot. A VCF strip mixing
   SNPs and SVs in one point mark loses its per-instance dash, which is the
   case the branch was written for; no shipped config draws one. The
   `mark-display` browser suite's goldens move with it; CI reports them and
   they are fixed forward. Write it as an ADR.

## Left open by the re-run review

- `domainQuantile` has no range check: 0 or below puts each end at the
  smallest magnitude, and 99 typed as a percent reads as the extremes. Slots
  have no numeric bounds to declare, and only a hand-typed value reaches it.
- A log scale with Clip outliers anchors its bottom at 0 before
  `getNiceDomain` floors it at max/100, so data below 1 loses about a decade;
  it predates ADR-179.
- Clip outliers re-ticks at the scale's default, not a value a config wrote
  before the untick; the help text names the one in force.

## Not defects, checked during the scan

- `symlogConstant: 0` meaning "derive from the domain" is a sentinel, contained
  in `resolveSymlogConstant` and documented on the slot; a `maybeNumber` would
  read cleaner and changes nothing drawn.
- Three docs checks were red on main before the round and stay so: a
  `GRAPH_TRACK.md` path in the HPRC handoff, `displayControls` in the
  tree-sidebar CLAUDE.md, four deleted symbols named in reference docs, and the
  pangenome pages' duplicated link titles. `packages/display-kit`'s
  `publicApi.test.ts` snapshot lacks `./viewRegionTable`, also main's.
