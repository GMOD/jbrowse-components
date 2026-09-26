---
name: grammar-scan-2026-09-26-evening
description: What the 2026-09-26 evening grammar scan left open after ADR-179 (domainQuantile) landed - the point mark's dash-by-default rule, which every shipped point config works around with x2 "start", and the Opus review of ADR-179 whose report had not arrived at the cut. Read before touching the point shape or the mark vocabulary.
---

# Grammar scan, 2026-09-26 evening

The session ran out of tokens after landing [ADR-179](../architecture-decision-records/adr-179-an-open-scale-end-follows-one-quantile.md).
**Delete this file once both items below are done.**

## Next, in order

1. **The point mark's dash rule is the next vocabulary fix.** `pointMark.slang`
   draws a point as a horizontal bar whenever `x2 - x` is wider than its glyph
   (`pointDrawsBar`), so a `point` over any interval feature draws as a dash,
   and every shipped point config over a BED writes `x2: "start"` to get a dot:
   `test_data/volvox/config_marks.json`, `website/docs/tutorials/read_marks.md`,
   `website/docs/config_guides/mark_display_examples.md` and its spec, and the
   `mark_display.md` sentence explaining the workaround. The grammar spelling is
   Vega-Lite's: a `point` stands at the centre of `[x, x2]` and never widens,
   and a `tick` is the horizontal bar across the extent, `size` px thick, at
   least a pixel wide. One shape serves both through a uniform (`tick`), which
   retires the per-instance branch and its three readers (vertex stage, painter
   fork, hit fork) and the `pointDrawsBar` js-export. Then: `MARK_TYPES` gains
   `tick` (`markVocabulary.ts`, mirrored in the CLI validator's copy under
   `products/jbrowse-cli/src/commands/validate/markRules/`), `markList.ts`
   binds it to the point shape, `markProblems.ts`'s size rule admits it, the
   vocabulary table in `mark_display.md` gets a row (`geom_tile` /
   `"mark": "tick"`), the `x2: "start"` workarounds go, `dog10k.ts`'s Fst
   windows and any BigWig tier min/max plot become `tick` to keep their
   pictures, and the points figures (`mark_display_examples/points`,
   read_marks) are re-shot. The `mark-display` browser suite's goldens move
   with it; CI reports them and they are fixed forward. Write it as an ADR.
2. **An Opus adversarial review of ADR-179 was running at the cut** (commit
   `700f3cdadf`). Its brief: leftover readers of the old spellings, the whiskers
   and all-negative cases of `autoscaleDomainFromSpans`, the nearest-rank
   quantile against Hi-C's `floor` rank in `countStats.ts` (two rank rules for
   one word, worth unifying), `computeVisibleCoverageDomain`'s `[0, top]`, the
   Clip outliers checkbox and its test id, and the v4 `autoscale` lift. Re-run
   it, or check those points by hand, before building on the slot.

## Not defects, checked during the scan

- `symlogConstant: 0` meaning "derive from the domain" is a sentinel, contained
  in `resolveSymlogConstant` and documented on the slot; a `maybeNumber` would
  read cleaner and changes nothing drawn.
- Three docs checks were red on main before the round and stay so: a
  `GRAPH_TRACK.md` path in the HPRC handoff, `displayControls` in the
  tree-sidebar CLAUDE.md, four deleted symbols named in reference docs, and the
  pangenome pages' duplicated link titles. `packages/display-kit`'s
  `publicApi.test.ts` snapshot lacks `./viewRegionTable`, also main's.
