# Screenshot review — handoff / next steps

Tracks the website screenshot specs (`website/scripts/screenshot-specs.ts`)
flagged `bad` in `website/scripts/screenshot-review.json` (the review file is
**gitignored** local state, not committed; it's the source of truth for what's
still open and carries the reviewer's per-spec `note`).

## How to regenerate

```
cd website && pnpm generate-screenshots --filter=<name> --exact
```

- Output lands in `website/static/img/<name>.png`; on failure a
  `debug_<name>.png` is written alongside (read it to see where a click landed).
- Generation serves the prebuilt `products/jbrowse-web/build` — **rebuild
  jbrowse-web** (`cd products/jbrowse-web && pnpm build`) after any app-source
  change (e.g. a new `data-testid`) before the testid shows up in a capture.
- Multiple agents serialize the edit-spec + regenerate critical section through a
  shared mkdir-based lock (`bash /tmp/jb-shot-lock.sh acquire|release`) so they
  never collide on the single generator port (3334) or on `screenshot-specs.ts`.

## Gotchas (durable)

- hg19 in config_demo displays the refname as `1` (no `chr`) in the ruler, but
  `loc` and `readyText` accept `chr1`-style too (refNameAliases). For specs that
  start with **no tracks**, wait on a menubar/UI string (e.g. `Open track
  selector`), not a chromosome label.
- Right-click/coordinate clicks are width-sensitive: changing `viewportWidth`
  moves genomic columns, so recompute `from.x` (content fills ~full width, near-
  zero left offset; SNP x ≈ region-fraction × width). The generator default
  viewport is 1500×800 at deviceScaleFactor 2 (so PNGs are 2×).
- Display config overrides (`showDescriptions`, `showLabels`, `defaultRendering`,
  `autoscale`, `resolution`, …) can be set **flat** inside `displaySnapshot` — a
  preProcessSnapshot collects declared config keys into the override map.
- Annotation box/circle callout `stroke-width` is **5** (bumped from 3, globally,
  per reviewer); the `text` annotation supports a `background` pill for legibility
  over busy figures. Figures regenerated before the stroke bump still carry the
  thin stroke until next regen (not mass-regenerated).
- The generator only serves `products/jbrowse-web/build` and the repo root, so
  any data outside the repo (e.g. `~/src/jb2hubs/`) must be **rehosted remotely**
  (under jbrowse.org) before it loads headless.

## Resolved history (condensed)

Earlier passes resolved the bulk of the originally-flagged set: region/config
fixes, two-stage menu+result figures, the `background` text-pill + `BaseCard-*` /
`drawer-widget` testids, graphviz architecture diagrams
(`website/diagrams/*.dot`), and a batch of declarative rebuilds (`multisv`,
`cnv`, `inverted_duplication` merge, etc.). Deletions/dedup collapsed several
duplicates (`skbr3_translocation`, `sv_inspector_begin/importform`,
`dotplot_menu`, `alignments_center_line_menu`, `rnaseq/overview`,
`alignments/modifications3`, `admin_settings_access`, `admin_server`). Desktop
`desktop-*` specs are produced by the separate desktop autogen
(`products/jbrowse-desktop/test/screenshots.ts`, Selenium+Electron) and are
classified via `desktopAutogenNames` in `screenshot-review-lib.ts`.

Most recent pass (second review round, `2026-06-11`): `alignments_center_line`
(de-staged), `alignments_soft_clipped_menu` (zoom + narrow), `alignments_sort_by_base`
(narrow + recomputed click), `bigwig/whole_genome_coverage` (scatter), `cnv`
(default palette + `resolution:5`), `bookmark_widget_create` (config_demo PTEN +
short), `bookmark_widget_edit_label` (shorter), `favorite_tracks` (global thicker
callout strokes), `customized_feature_details` (text background pill), `hic_track`
(`showDescriptions:false`), `gwas/manhattan` (shorter track), `alignments/arc_display`
(HG002 Illumina + HG002 GIAB SV VCF over a 1.4kb Tier-1 deletion at
`chr1:1,285,401-1,286,800`).

## Still open (24) — current reviewer asks + next steps

### Quick-ish spec edits (achievable, just need a regen)

- **`horizontally_flip`** — "the 'view options' menu is expanded which should not
  happen". The two-stage flow leaves the view menu open in the result frame;
  dismiss it (click the location box) or drop to a single post-flip frame.
- **`inverted_duplication`** — make the arcs point **upwards** and the coverage
  track **taller**; then click `HGSV_2721` to open feature details; **remove** the
  second frame of the two-step (single frame). Used only in `sv_visualization.md`.
- **`alignments_track_arcs`** — GAPDH (`chr12:6,643,000-6,648,000`) still shows
  many small sashimi arcs; pick a gene with fewer isoforms / cleaner splicing
  (data look at the RNA-seq `Pairend_StrandSpecific_51mer_Human_hg19` track).
- **`linear_synteny`** — reviewer rejected the declarative rebuild ("just use the
  sharelink in gallery.md, it does not look good as is"). Switch the spec to the
  gallery share link, or match that figure's exact look.

### Autogenerate a manual figure (no spec exists yet — must be authored)

- **`menu_demo`** — "if possible autogenerate".
- **`link_to_split_view`** — load `14:84,871,462..84,871,480`, click the
  translocation, annotate the "launch split views" menu item.
- **`multiwig/trackselector`** — multi-step puppeteer script, `convert -append`
  each step into one stacked image.
- **`multi-sv-trio`** — region `1:40,481,472..40,524,349` with the 1kg config (see
  gallery / demos.md): trio HG02030/HG02031/HG02032 reads + the 1kg illumina
  ensembl VCF.
- **`protein/structure`** — use the `~/src/jb2plugins/jbrowse-plugin-protein3d`
  URL-param format to autogen.

### Methylation (autogen + data)

- **`methylation/colo829_cram_and_bedmethyl`** — autogen: `20:10,000,000-10,000,475`,
  `colo_829_tumor.ht` track with modifications + the bedmethyl track as a
  MultiQuantitativeTrack.
- **`methylation/per_read_mod_bam`** — autogen: `20:9,990,000..10,010,002`, colorBy
  "all modifications" preset loaded.
- **`methylation/arabidopsis_bisulfite_chh`** — remote emseq bam covers only
  ~50–53 kb and is mostly unmethylated; finding a methylated CHH window needs
  reference-context analysis of the remote bisulfite reads.

### sv_cgiab (remote giant-assembly + rehost + multiwiggle builds)

- **`sv_cgiab/dotplot_result`** & **`sv_cgiab/synteny_view`** — render blank; the
  giant HG008T.hap1 remote-assembly PAF doesn't paint within the settle window and
  there's no reliable readiness gate (the `*_done` testid may not fire). Needs
  online/interactive debugging or a real paint-complete signal.
- **`sv_cgiab/deletion_linear_view`** — region `chr10:122,822,042-122,850,825` +
  the hg38 `ncbiRefSeq.gff` from `~/src/jb2hubs/` — must be rehosted remotely
  first (outside the served root), then added as a session track.
- **`sv_cgiab/cnv_with_bed_track`** — localsd scaling + a normal-vs-tumor
  multiwiggle (build a `MultiWiggleAdapter` over the HG008 normal/tumor coverage,
  `autoscale: 'localsd'`).
- **`sv_cgiab/cnv_multi_bigwig`** + **`sv_cgiab/cnv_score_limit`** — combine into a
  single multi-step figure.

### Blocked on app/shader changes (own PRs, out of scope for spec edits)

- **`alignments/read_cloud`** — origin/main used a **log scale** for the samplot
  read-cloud Y (|tlen|), which shows small insertions better; current branch is
  linear (`features/arcs/compute.ts`). A proper fix spans the `.slang` shader +
  Canvas2D draw + autoscale (then `pnpm gen:shaders` + rebuild).
- **`alignment_clipping_indicators`** — inverted clipping histograms render smaller
  than origin/main; likely a webgl-poc draw-path regression in the alignments
  coverage/indicator path.
- **`alignments/select_arc_display`** — reviewer wants "show pair overlay" to be a
  checkbox (`Show read arcs` / `Show read cloud`, both toggleable) instead of a
  submenu — an app UI change, not a screenshot fix.

### Blocked on remote infra

- **`multiwig/multi_colorselect`** — spec is correct (per-source `layout` colors
  over `microarray_multi`'s 21 ENCODE bigWigs: red on ENCFF055ZII/826HEW/858LIM,
  green on the next 10, blue on the last 8; two-stage editor + result). BLOCKED:
  `www.encodeproject.org` returns 403/502 to the headless browser. Re-run when
  encode is healthy, or rehost the 21 bigWigs under jbrowse.org and repoint.
- **`desktop-session`** — wants an hg38 demo with NCBI RefSeq + ClinVar variants;
  hg38 isn't loadable in the served-test-data headless run and there's no
  track-selector harness helper. Deferred.

### Needs a data look / decision

- **`rnaseq/compact_stacked`** — spurious forward-strand sashimi arcs among the
  predominantly reverse-strand ones; confirm whether real antisense / multi-gene
  window or a strand bug, then either tighten the window or add a strand filter.

## Context: reverted item (not currently flagged bad)

- **`feature_detail_sequence`** — reviewer wanted human FAF1 on config_demo;
  reverted to the working volvox EDEN figure (still shows colored upstream/exon/
  intron/downstream sequence). Hard because: the **gene-level** sequence panel is
  only a transcript container (no full-introns/CDS/peptide option — must open on a
  **transcript**); transcript glyphs are canvas-baked with no DOM text/overlay to
  click (only the gene gets a `feature-name-<name>` div, conditional on overlay-
  label mode), so selecting a transcript needs a coordinate click; the Gencode GFF
  labels by Ensembl ID, RefSeq (`ncbi_gff_hg19`) by description. Next step: at the
  live URL below, click an `NM_…` transcript row of FAF1, "Show feature sequence" →
  "Genomic w/ full introns +/- …", capture the row pixel and port to a coordinate
  click (or add a stable per-transcript testid in the canvas overlay-label path).
  Live: https://jbrowse.org/code/jb2/latest/?config=test_data/config_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%221%3A50%2C938%2C000-51%2C065%2C000%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%22ncbi_gff_hg19%22%2C%22displaySnapshot%22%3A%7B%22height%22%3A300%7D%7D%5D%7D%5D%7D
