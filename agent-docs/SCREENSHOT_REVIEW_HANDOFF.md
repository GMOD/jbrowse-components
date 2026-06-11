# Screenshot review — handoff / next steps

Tracks the website screenshot specs (`website/scripts/screenshot-specs.ts`) flagged
`bad` in `website/scripts/screenshot-review.json`. Regenerate one with:

```
cd website && pnpm generate-screenshots --filter=<name> --exact
```

Output lands in `website/static/img/<name>.png`; on failure a
`debug_<name>.png` is written alongside. Generation serves the prebuilt
`products/jbrowse-web/build` — **rebuild jbrowse-web** (`cd products/jbrowse-web
&& pnpm build`) after any app-source change (e.g. a new `data-testid`) before the
testid shows up in a capture.

## Done this pass (verified by regenerating unless noted)

- Region/config fixes: `variant_with_pileup`, `alignments/compact`, `hic_track`,
  `searching_lgv` (config_demo hg19 + "brca"), `gwas/manhattan` (human chr2),
  `methylation/arabidopsis_chh` (moved to the methylated 15.5–18kb window),
  `recent_tracks`/`tracklabels`/`bookmark_widget_edit_label` (config_demo),
  `lgv_assembly`/`favorite_tracks`/`drawer_widget_toggle`/`add_track_form`
  (smaller windows), `insertion` (capped PacBio track height), `inverted_duplication`
  (taller track).
- Two-stage / combined figures: `alignments_center_line`(+menu),
  `alignments_soft_clipped_menu`(+result), `alignments_sort_by_base`,
  `dotplot_add`(+`dotplot_menu`), `plugin_store`, `bookmark_widget_create`,
  `favorite_tracks`, `drawer_widget_toggle`, `alignments/modifications1`,
  `multiwig/addtrack`, `alignments/select_arc_display`,
  `sv_cgiab/translocation_sv_inspector_start` (Add-menu + import form, also
  replaces the deleted `sv_inspector_begin` / `sv_inspector_importform`).
- Annotations: `trio-matrix`, `trio-matrix-phased`,
  `hierarchical/hierarchical_user_menu-fs8`, `variant_panel` (new
  `BaseCard-Samples` testid), `add_track_tracklist` / `lgv_usage_guide` /
  `sv_synteny/dotplot_import` / `sv_inspector_importform_after` (text callouts now
  use the new `background` pill via `Annotation.background`).
- Deletions: `insertion_indicators`, `rnaseq/overview` (replaced by
  `rnaseq/basic_splicing`), `sv_inspector_begin`, `sv_inspector_importform`,
  `dotplot_menu`, `alignments_center_line_menu`.

App-source changes made (need the rebuild already done this pass to stay in the
deployed build): `data-testid="drawer-widget"` on the drawer Paper
(`packages/app-core/src/ui/App/Drawer.tsx`) and `data-testid="BaseCard-${title}"`
on `BaseCard` (`packages/core/.../BaseFeatureDetail/BaseCard.tsx`), plus the
`background` text-pill option in the screenshot annotation renderer
(`website/scripts/generate-screenshots.ts`).

## Remaining / deferred

### feature_detail_sequence — human FAF1 (currently reverted to volvox EDEN)

Reviewer wanted a human FAF1 example on config_demo. Blocked headless and reverted
to the working volvox EDEN figure (still shows the colored upstream/exon/intron/
downstream sequence the doc needs).

Why it's hard:
- The **gene-level** sequence panel is only a container for transcripts and offers
  no full-introns/CDS/peptide option — you must open the panel on a **transcript**.
- Transcript glyphs in the canvas basic display are canvas-baked at this zoom: no
  DOM text label / overlay div, so they can't be reached with a text click. Only
  the gene gets a clickable `feature-name-<name>` div (and even that is conditional
  on overlay-label mode). So selecting a transcript needs a coordinate click.
- The Gencode GFF track labels by Ensembl ID (ENSG…), not "FAF1"; RefSeq
  (`ncbi_gff_hg19`) labels by description ("Fas associated factor 1").

Next step to finish it: at the live URL below, click a **transcript row** of FAF1
(e.g. an `NM_…` isoform), then "Show feature sequence" → "Genomic w/ full introns
+/- …". Capture the transcript-row pixel and port to a coordinate click, or add a
stable per-transcript testid in the canvas overlay-label path.

Live: https://jbrowse.org/code/jb2/latest/?config=test_data/config_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%221%3A50%2C938%2C000-51%2C065%2C000%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%22ncbi_gff_hg19%22%2C%22displaySnapshot%22%3A%7B%22height%22%3A300%7D%7D%5D%7D%5D%7D

Related UX thought (per review): the gene-level sequence panel offering nothing is
"more confusing than helpful"; and canvas feature labels not being
text/accessibility-reachable is a real a11y gap. Both are app-level changes, out of
scope for the screenshots.

### Needs an app/shader change

- `alignments/read_cloud` — main used a **log scale** for the samplot read-cloud Y
  (|tlen|), which shows small insertions better. Current branch is linear
  (`features/arcs/compute.ts` flat lines at Y=|tlen|). A proper fix spans the
  `.slang` shader + Canvas2D draw + autoscale (then `pnpm gen:shaders` + rebuild) —
  its own focused PR.
- `alignment_clipping_indicators` — the inverted clipping histograms render smaller
  than origin/main; likely a webgl-poc rendering regression to investigate in the
  alignments coverage/indicator draw path.

### Data / region hunts (need exploration or a decision)

- `methylation/arabidopsis_bisulfite_chh` — the emseq bam is remote and only covers
  ~50–53kb (different data from the ONT bam); finding a methylated CHH window needs
  reference-context analysis of the remote bisulfite reads.
- `multisv` — rebuild declaratively (currently a share link): region
  `19:42,749,096..47,802,386`, multi-sample variant display, sorted by genotype on
  the large inversion SV.
- `cnv` — reviewer wants an overlapping scatter-plot rendering instead of the
  stacked multi-wiggle.
- `multiwig/multi_colorselect` — reviewer wants red on first 3 / green on next 10 /
  blue on the rest of the ENCODE multiwiggle (needs a per-source color preset).
- `alignments_track_arcs` — pick a gene with fewer isoforms (currently GAPDH still
  shows many small sashimi arcs).
- `linear_synteny` — reproduce the origin/main figure.
- `inverted_duplication/normal_height` — green read pairs not visible (is that
  expected?); combine with `inverted_duplication` and use only in
  sv_visualization.md.
- `alignments/arc_display` — reviewer asked for `chr1:72,548,824..72,163,654`, but
  that locus only carries small indels (see the spec comment); kept the SKBR3
  translocation. Confirm desired locus.
- `sv_cgiab/dotplot_result` & `sv_cgiab/synteny_view` — render blank; likely the
  giant remote assembly PAF not painting within the settle window. Needs a
  reliable readiness signal or longer/online debugging.
- `sv_cgiab/deletion_linear_view` (region chr10:122,822,042-122,850,825 + hg38
  ncbiRefSeq.gff), `sv_cgiab/cnv_with_bed_track` (localsd scaling + normal-vs-tumor
  multiwiggle), `sv_cgiab/cnv_show_all_regions` (odd crop) — still open.
- `rnaseq/compact_stacked` — spurious forward-strand sashimi arcs among the
  predominantly reverse-strand ones; confirm whether real or a strand bug.

## Notes

- hg19 in config_demo displays the refname as `1` (no `chr`), so `readyText` must be
  `1`-style or a track name, never `chr1`.
- For specs that start with no tracks, wait on a menubar/UI string (e.g.
  `Open track selector`), not a chromosome label.
