---
name: row-model-colour-and-mark-rows
description: State of the row-model thread on 2026-09-24. Step 4's first half (ADR-160, one rowColor channel and one dealer) and rows on the mark display (ADR-157's fifth display) are on main; the colour half's zero-image-diff browser run was never recorded; ten calls are Colin's, each answered by a page not yet made, and no visible flip lands before them. Read before touching a row display's colour, bands, the mark display's rows or the palette.
---

# Row model: colour and mark rows

The thread is
[one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md):
step 3 is done, step 4's first half and step 6 for bar and point marks have
landed, and the design-pass plans for steps 4–6 are appended to that doc.

## On main

- **Step 4, first half:** `1db2c62d90`…`9ace74a1ad`, recorded as
  [ADR-160](../architecture-decision-records/adr-160-a-rows-colour-is-one-categorical-channel-on-the-row-axis.md).
  It landed unreviewed. The review that followed on 2026-09-24 traced the code
  and could not probe it. Its two confirmed findings are policy rather than
  bugs, and ADR-160's Consequences lists them under call 5.
- **Rows on the mark display:** `a1f54d5ea2`…`e689ad5517`, the fifth display in
  ADR-157. The review's seven findings are fixed. The `MultiQuantitativeTrack`
  seed stays on the wiggle entry, so a mark display draws main's picture
  (call 10).
- **Rebase damage, repaired 2026-09-24:** the colour branch's last rebase had
  - emptied `packages/tree-sidebar/CLAUDE.md`,
  - numbered its ADR 159 beside the mark/shape ADR,
  - left the mark display dealing an unpainted palette,
  - left its census red, and
  - left autogen stale.

## Not run

**The colour half's zero-image-diff browser run.** Its brief required it on
canvas2d and webgl against the pulled goldens, for wiggle, multi-row, variants
and MAF, and nothing records it after the rebase. The review's trace found
parity everywhere except the deviations ADR-160 already lists.

## Colin's calls, each answered by a page not yet made

1. The palette: a side-by-side of every candidate per display at 5, 20 and 100
   rows, plus a deuteranopia column. The candidates and scenes are in the
   step-4 plan. The question: at 20 rows, which palette keeps neighbours apart
   on a 1 px line and a 4 px block? And past its length, wrap or re-lit laps?
   The multi-row display recolours rows on a pan until the dealer's order
   changes with this call.
2. Label boxes always tinted on multi-row and rows-layout wiggle (on/off pair).
3. Variants' value order: first-seen versus count-ranked (the legend both ways).
4. A field mapping versus a samplesTsv colour column (no fixture has one).
5. The hand recolour under a field turning every row's colour into `name`
   pairs, and what that costs a Color by (ADR-160's Consequences).
6. Band chips on the row displays (the 1000 Genomes matrix by population; four
   figures move).
7. A band field set over a clustered cohort: bands with an empty gutter and a
   re-run hint, or no bands and the tree kept.
8. Each band's dendrogram at full gutter width, or one shared depth scale.
9. `pile` or `stack` for the pileup channel replacing `encoding.row`; and
   whether hiding a band is config or stays volatile.
10. One row per source as the mark display's default over a multi-BigWig.

## Next steps, in order

1. The browser run above.
2. The two pages: the palette side-by-side, and a tour of what steps 3–4
   changed on screen (drag, cluster, undo, reset on an agent-built track, the
   MAF guide tree turning).
3. Step 4's second half per the plan: the legend by field value, then retiring
   `colorRowLabels` and `rowGroups[].color`, then the palette flip, one commit
   per display naming its figures.
4. Step 5 per the plan: a tree per band, its zero-pixel half first.
5. Harden the hook seam: static hooks become mixin factory options and dynamic
   ones getters, plus a test that no display redefines a mixin member outside
   the declared list.
6. Small fixes:
   - the phased-relabel fetch-autorun re-run the census found (variants'
     `workCensus.test.ts`, the relabel line);
   - a phased dialog opened before the first cellData and submitted over
     haplotype rows still writes the sample order;
   - `BaseTrackModel.canConfigure` reads the whole delta map;
   - the add-a-track census line resolves every observed id.
