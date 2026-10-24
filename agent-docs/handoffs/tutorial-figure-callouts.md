---
name: tutorial-figure-callouts
description: "Tutorial figures that leave a first-time reader guessing. The giab_hg002_reads pass is on main (deletion and insertion highlights, platform and haplotype pills, methylated/unmethylated labels, haplotype_groupby cut to two panels). Open: the Show... → Soft clipping and Color by... → Modifications menu figures, a sweep of every other tutorial for bare figures, two smalldel nits."
---

# Tutorial figure callouts: what is left

- **In:** a tutorial figure and the question "what would a reader new to JBrowse not know?"
- **Out:** a highlight, pill, leader label or menu box that answers it, in the figure's spec.

The `giab_hg002_reads` pass is committed. Specs touched:

- `smalldel`: `website/scripts/specs/sv.ts`
- `insertion`: `website/scripts/specs/ui.ts`
- `methylation/hg002_snrpn_grouped`: `website/scripts/specs/methylation.ts`
- `alignments/haplotype_groupby`: `website/scripts/specs/alignments.ts`

Rules: callouts and captions in `website/CLAUDE.md`, anchors and `highlights` in
`website/scripts/CLAUDE.md`, capture in
[FIGURE_CAPTURE.md](../reference/FIGURE_CAPTURE.md).

## Next, in order

1. **Two menu figures the prose depends on.** `website/docs/tutorials/giab_hg002_reads.md`
   tells the reader to open **Show... → Soft clipping** and **Color by... →
   Modifications**, and no figure shows either menu.
   - Build each from `menuCascade` and `cascadeBoxes` in
     `website/scripts/screenshot-spec-helpers.ts`, as `alignments/compact` does.
   - `check-figure-actions` ratchets the recipe lines; run it after.
2. **Sweep the other tutorials.** For each figure under `website/docs/tutorials/`
   whose spec has no `annotations`, `highlight` or `stages`, ask the question
   above. The `giab_hg002_reads` rubric:
   - A mark the reader cannot name: a session `highlight` with a `label` first,
     since it reaches every track.
   - A mark a highlight cannot reach (a fan of soft-clipped bases): one
     `leader: true` label.
   - A track or group name too small at figure scale: a pill.
   - A color with no legend (red and blue methylation): a short label on each.
   - A stack of three or more panels: cut to two by dropping the panel the next
     figure on the page already shows.
3. **Two nits on `smalldel`.** The "Haplotype 1" and "Haplotype 2" pills cover a
   little of the coverage band, and the frame still ends in a blank band under
   the reads.

## Colin's constraints

- Few callouts, each a few words in plain language; delete one before shortening it.
- No counts and no step numbers on a figure.
- The app chrome stays in the frame, and capture width stays at the realistic ~1500 px.
- A stacked figure stops at two panels (2026-10-24).

## Running a capture from a worktree

- A fresh worktree has no `products/jbrowse-web/build`, and its dev server failed
  to compile on 2026-10-24 (`webpack-dev-middleware/client/utils/log.js`: "Can't
  import the named export 'Logger'"). `pnpm --filter @jbrowse/web build` in the
  worktree works.
- The primary's `website/static/img` holds the pre-pass PNGs until `pnpm figures:pull`.
- File an issue for the dev-server compile failure; no other doc tracks it.
