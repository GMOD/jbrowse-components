---
name: tutorial-figure-callouts
description: "Tutorial figures that leave a first-time reader guessing. The giab_hg002_reads pass, its two menu figures and a first sweep (gene_prediction_merge, read_marks, trio matrix, imprinted 5mC, the launch stack) are on main. Open: five sweep figures needing a callout whose anchor or meaning wants checking first (maize WGD fans, GSTT1, non-canonical junctions, E. coli operons, amylase ribbon colors)."
---

# Tutorial figure callouts: what is left

- **In:** a tutorial figure and the question "what would a reader new to JBrowse not know?"
- **Out:** a highlight, pill, leader label or menu box that answers it, in the figure's spec.

Rules: callouts and captions in `website/CLAUDE.md`, anchors and `highlights` in
`website/scripts/CLAUDE.md`, capture in
[FIGURE_CAPTURE.md](../reference/FIGURE_CAPTURE.md).

## Next, most confusing first

Each needs its anchor or its claim checked against the data before writing.

1. `orthofinder_synteny/grasses_maize_wgd` (`website/scripts/specs/synteny.ts`):
   the blue and purple fans have no legend, and `encoding.color: 'target'`
   paints them by maize chromosome. One label per fan, "Maize 1" and "Maize 5",
   anchored by locus in the maize row.
2. `multiway_synteny/hprc_gstt1_lanes`: GSTT1 is absent from hg38's chr22, so no
   highlight reaches it. One `leader: true` label on the gene in the first lane
   carrying it.
3. `rnaseq/sashimi_all_junctions`, the top half of `rnaseq/hide_non_canonical`
   (`website/scripts/specs/alignments.ts`): one `leader: true` "Non-canonical"
   label on the thin red arcs.
4. `multiway_synteny/ecoli_symbol_atp_operon` and `ecoli_symbol_oantigen`: one
   session highlight per figure on K-12 coordinates, "atp operon" and
   "O-antigen cluster".
5. `multiway_synteny/hprc_amylase_stack`: the yellow and blue ribbon fills have
   no legend. Read what each encodes (CIGAR insertion, strand) before labeling.

Borderline: `pangenome/bovine_polled`'s highlight lacks a `label`; `multisv_rhd`
could take an "RHD" highlight.

## Colin's constraints

- Few callouts, each a few words in plain language; delete one before shortening it.
- No counts and no step numbers on a figure.
- The app chrome stays in the frame, and capture width stays at the realistic ~1500 px.
- A stacked figure stops at two panels (2026-10-24).
- Prefer a pill on the app's own label to a highlight chip when the name is what
  the reader needs: a highlight's label is app-sized text, ~7px at figure scale.

## Seen in passing

- `agent_synteny/inversion_2r`'s published PNG (the lock's, shot before
  ab0faca9f0) draws four ribbon colors, while its spec and caption say strand
  colors. It needs a reshoot.
- The all-vs-all lanes now draw a "Show 1 hidden" chip on CFT073
  (`multiway_synteny/ecoli_launch_selection`), from a display change on main.

## Capturing on the laptop

With ada's ssh refused, a worktree build (`pnpm --filter @jbrowse/web build`)
and `website/scripts/generate-screenshots.ts`, run from `website/` with a short
`TMPDIR`, `--filter <names>` and a free `--localport`, worked after symlinking
`website/static/img` and `website/static/media` to the primary's.
