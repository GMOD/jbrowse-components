# Handoff: single-cell RNA demo (UMAP + pseudobulk + per-cell rows)

Built 2026-08-01. Nothing is committed: the worktree had another agent's TCGA
tutorial mid-flight, so committing was left to a human with an explicit pathspec.
All hosted data is uploaded and live.

## What exists and is verified

An embedded LGV demo at `/storybook/lgv/single-cell-umap` pairing a UMAP of 4390
PBMCs with per-cell-type coverage, plus a third track of one row per cell.
Verified in a browser (puppeteer against `astro dev`), all three interactions:

- **cells to tracks**: clicking `CD8 T` greys the other clusters and collapses
  the pseudobulk track from nine rows to one, via
  `display.setSubtreeFilter(['CD8 T'])`.
- **tracks to cells**: picking a gene navigates the view and recolors the UMAP
  from `session.selection`; at MS4A1 the B island goes dark and the rest
  near-white.
- **per-cell raster**: at LYZ the monocyte block is solid brown at the 3' end,
  the cDC block magenta below it, and the lymphocyte blocks carry faint speckle,
  which is ambient RNA that the pooled row above draws as a flat line.

## Data, all live under `https://jbrowse.org/demos/scrna_pbmc5k/`

- nine per-cell-type BigWigs, 484MB (`CD4_T.bw` is 141MB)
- `cells.json` (75KB: UMAP coords, labels, palette, gene index, 109-gene panel),
  `expr.bin` (407KB sparse quantized expression), `sources.json`
- `percell.zarr`, **0.70MB** for 4390 cells over seven marker windows

A local copy of everything, plus the 260MB labeled `pbmc5k_scrna.h5ad`, is in
`~/scrna_pbmc5k_build/`. The h5ad is **not** uploaded (the user chose BigWigs +
web data only).

## Uncommitted files

Mine, safe to commit as a set:

- `products/jbrowse-react-linear-genome-view/examples-site/`:
  `src/examples/SingleCellUmap.tsx`, `src/components/UmapScatter.tsx`,
  `src/pages/single-cell-umap.astro`, `src/docs/single-cell-umap.md`,
  plus `src/examples.ts` and `package.json` (adds `@jbrowse/plugin-wiggle` for
  the `MultiWiggleDisplayModel` type)
- `plugins/wiggle/src/index.ts` — exports `MultiWiggleDisplayModel`, mirroring
  the already-exported single-display `WiggleDisplayModel`
- `scripts/build_scrna_pseudobulk.sh` — the whole reproducer
- `test_data/scrna_pbmc5k/config.json` — the tutorial's own config
- `website/docs/tutorials/scrna_pseudobulk.md`, `website/scripts/specs/scrna.ts`,
  `website/scripts/screenshot-specs.ts` (registration), `website/src/lib/gallery.ts`
  (one card)

Shared/generated, check before including: `website/src/lib/galleryLinks.generated.ts`
(regenerated, may carry another agent's specs), `pnpm-lock.yaml`,
`website/docs/user_guide.md` (already contains both my tutorial entry and the
TCGA one).

## The one thing not done

**The four figures are not generated**, so the tutorial's `<Figure>` tags point
at missing images and the tutorial thumbnail does not exist yet. The generator
failed with `EADDRINUSE` on port 3334 because another agent was running it
concurrently. Nothing else blocks it:

```bash
cd website
node scripts/generate-screenshots.ts \
  --filter scrna/ms4a1_bcell --filter scrna/lyz_monocyte \
  --filter scrna/percell_lyz --filter scrna/rna_atac_ms4a1
node scripts/gen-tutorial-thumbs.ts        # then --check
```

`products/jbrowse-web/build` is current enough (the only source change is a
type-only export). After that run `pnpm autogen --check` and `pnpm check-docs`.

## Decisions worth not relitigating

**The dataset is 10x 5k PBMC v3, hg38, and the BAM is never downloaded.** All 23GB
are read by region over HTTPS, six chromosomes at a time, in ~40 minutes with no
scratch disk. This machine has 47GB free, so the usual `sinto` split-the-BAM
route does not fit. `pysam`'s bundled libcurl cannot find the system CA bundle on
its own: without `CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt` every open
fails with curl error 77.

**CellRanger 3.0.2 ships t-SNE, not UMAP.** The UMAP is scanpy's, computed from
the count matrix. Its graph-based clusters are also too coarse to label: at eight
clusters CD16 monocytes and cDC2 merge into one, and a 288-cell cluster has no
upregulated genes at all. Leiden at resolution 1.0 gives 18 clusters that label
cleanly, and the scanpy QC filter removes the junk cluster on its own, which is
why nothing lands as Unassigned.

**Labels come from marker-panel argmax and the script prints the whole score
matrix.** The winners are decisive (Platelet 13.3, pDC 10.2, cDC 3.7, CD16 Mono
3.0). A cluster scoring under `MIN_PANEL_SCORE` is labeled Unassigned rather than
folded into the nearest lineage.

**`bedGraphToBigWig` wants lexicographic chromosome order** (chr1, chr10, chr11,
… chr2), not the numeric order the chromosomes are streamed in. Getting this
wrong wastes the whole streaming pass, since the failure only surfaces at the
merge. Fixed in the build script; `sorted(CHROMS, key=ucsc_name)`.

**The per-cell track's score axis is pinned, not autoscaled** (`minScore: 0`,
`maxScore: 4`). Autoscale puts the maximum at whatever the home cell type
reached (a monocyte carries a median 221 UMIs at LYZ), and every single-UMI cell
then renders white, which erases the ambient-RNA signal that is the entire reason
per-cell rows are there. 8 was tried first and is too high for MS4A1, where a
cell's 8 UMIs spread to 1-3 per bin. Same reasoning as
`project_1000g_population_cnv_tutorial`.

**Per-cell rows carry an explicit `color` per sample**, the cell type's hue. In
`multirowdensity` a row's `color` is its own ramp, so this makes the blocks read
in the same colors as the UMAP and the pooled rows. Without it the rows take
synthesized group colors, which match nothing.

**The Zarr store holds one window per chromosome.** Its bin axis keys spans by
refName, so two markers on one chromosome collide. The seven marker genes are
picked to sit on different chromosomes for that reason (FCGR3A, CD8A, PPBP,
IL7R, MS4A1, LYZ, NKG7). Per-cell coverage says nothing at a locus the cells have
no reads at, so covering marker windows rather than the genome is the design, and
it is why the store is under a megabyte.

**The figures use `test_data/scrna_pbmc5k/config.json`, not `config_demo.json`.**
The per-cell track needs the Zarr plugin declared, which is config-level, and the
user explicitly did not want `config_demo.json` touched. That config also carries
a copy of the PBMC scATAC subadapters so the RNA/ATAC pair figure works from one
config. Precedent: `test_data/1000g_cnv/config.json`.

## Honest limits to keep in the copy

Median cell detects 2240 genes, so per-cell rows say nothing at a
non-marker gene. Detection at a marker is high (MS4A1 99% of B cells at a median
8 UMIs, LYZ 100% of monocytes at 221, NKG7 100% of NK at 45) but CD8A is already
marginal at 70% and 3 UMIs. This is a marker-locus visualization, not a browsing
mode. Platelet and pDC are 21 and 22 cells, so those pseudobulk rows are
genuinely thin.
