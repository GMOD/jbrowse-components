# Screenshot-review handoff

Working through the `bad`-status items in
`website/scripts/screenshot-review.json` (the local, gitignored review log).
Extract them with:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.note)"' \
  website/scripts/screenshot-review.json
```

## Pipeline (how to fix one item)

1. Edit the spec in `website/scripts/screenshot-specs.ts` (find by `name:`).
2. Regenerate that one figure (run from `website/`):
   ```bash
   node --experimental-strip-types scripts/generate-screenshots.ts \
     --filter '<spec-name>' --exact --force
   ```
   - **Use `--force`.** The content-stable gate keeps the old PNG when a
     re-render differs by <0.5%, which silently skips small text/annotation
     edits.
   - The **Bash tool's 2-min default timeout kills specs that fetch big remote
     data** (1000g, cactus, celegans, cgiab). Pass a longer tool timeout
     (~400000ms). Concurrency is 4, so batch a few `--filter a,b,c` together.
   - A code change to a plugin needs `pnpm build` in `products/jbrowse-web`
     first — the generator renders the built bundle, not source.
3. Review the PNG. Capture is ~3000px wide; **downscale before Read**:
   ```bash
   convert static/img/<name>.png -resize 1000x /tmp/x.png   # then Read /tmp/x.png
   ```
4. Housekeeping after structural edits:
   - Changed a **gallery** spec's URL, or added/removed/renamed a spec →
     `pnpm gen:gallery-links` (CI gate: `pnpm gen:gallery-links-check`).
   - Added/removed a spec or a doc `<Figure>` → `pnpm audit-figures`.
   - `npx eslint --cache --fix scripts/screenshot-specs.ts` — **note:** eslint
     reflows the whole file, so it churns lines you didn't touch (inflates the
     diff, entangles with other agents' edits — see caveat below).

## Useful facts learned

- **NCBI gene tracks already in `config_demo.json`** (no rehosting needed to
  "add a gene track"): `ncbi_refseq_109_hg38_latest` (hg38), `ncbi_gff_hg19`
  (hg19). Add the trackId as the first entry in the session `tracks` array.
- **View-as-pairs** = `linkedReads: 'normal'` in a `displaySnapshot`. The
  pairs→`insertSizeAndOrientation` coloring only auto-applies via the *menu
  action*, NOT on snapshot load, so set `colorBy` explicitly in the snapshot too.
- **Dotplot init fields** (top-level in the session view object, routed to
  `init`): `autoDiagonalize: true`, `showColorLegend: false`, `colorBy`,
  `minAlignmentLength`. Same for LinearSyntenyView (`autoDiagonalize`, `colorBy`,
  `alpha`, `levelHeights`).
- **Arcs below coverage** = `readConnectionsDown: true` (the modern default).
- **`rowHeightOverride` is dead** — the `*Override` shadow-prop system was
  removed. Row height is the `rowHeight` config slot now.
- **Overlay-box positioning**: annotation `x`/`y` are page CSS px. Don't guess
  the constants — measure live. Pattern (there's a throwaway `measure-trio.ts`
  in git history if you want it back): `createTestServer` from
  `@jbrowse/browser-test-utils`, `page.goto(spec.url)`, wait for the display's
  canvas testid (e.g. `variant_canvas`, `multirow_canvas`), then
  `getBoundingClientRect()`. The trio figures broke because the VCF panel top
  drifted 276→268 when the painting track above shrank.

## IMPORTANT: the review log is largely STALE — triage by PNG hash first

`screenshot-review.json` lists ~71 `bad` items, but most are already fixed or
already deleted. Each review entry stores a `hash` (sha1 of the PNG it was made
against). An item is only *genuinely* still-bad when its committed PNG is
byte-identical to that hash — otherwise the figure has changed since the review
and the note is likely already addressed (the human just hasn't re-reviewed).
Triage before touching anything:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.hash)"' \
  scripts/screenshot-review.json | while IFS=$'\t' read -r name hash; do
  f="static/img/${name}.png"
  if [ ! -f "$f" ]; then echo "NOPNG (deleted)  $name"
  elif [ "$(sha1sum "$f" | cut -d' ' -f1)" = "$hash" ]; then echo "UNCHANGED (real) $name"
  else echo "changed (addressed?) $name"; fi
done
```

- **NOPNG** = spec+PNG already deleted (the many gallery deletes: chromhmm_*,
  gwas_sle_stat4, maize_te, human_trio_phased, pten_cds, rnaseq_paired,
  directrna_brca1). Resolved.
- **changed** = PNG differs from the reviewed one → fix likely already in the
  spec (verify by reading it; e.g. every BAF display already uses
  `defaultRendering:'scatter'`, not whiskers — the whisker notes are all stale).
- **UNCHANGED** = the real backlog. Even then, read the *whole* note: often one
  sub-part is stale (BAF whiskers) while another is open (trackLabels/height).

### Done this session (2026-07-06, webgl-poc, scoped commits)
- `lgv_usage_guide` drop drag-to-reorder callout; `linear_align_ctx_menu` arrow
  off the text box; `multiwig/addtrack` box the dropdown option (commit 8756873890)
- sv_cgiab `driver_smad4_loh` (trackLabels:offset + taller), `driver_chr17_loh`
  + `cnv_log2ratio_genome` (trackLabels:offset + `displayCrossHatches:true` on
  the log2-ratio band); BAF-whisker notes confirmed stale (971a24d4d2)
- `introgression` + `introgression_locus` explanatory blurbs (0166e9a326)
- `alignments/modifications2` reworded callouts (b1ad2a85da)
- `maf_470way` + `maf_470way_codon` MANE Select (NCBI RefSeq) session track via
  new `HG38_MANE_TRACK`; switched to `sessionSpec`; regen galleryLinks (91c43c6cdf).
  The hg38 470way assembly has refNameAliases so a chr-named BigBed aligns to
  the numeric '12' MAF refnames — reusable pattern for the other hg38 maf specs.

### Deferred with reason (not quick spec wins)
- `read_vs_ref_insertion` — note ("drop protein-translation/showReverse/legend
  from launched read-vs-ref synteny **by default**") is an app-default change in
  the synteny-launcher code, and the figure loads a *saved remote session* that
  already bakes those on. Needs a code change + a re-saved session, not a spec edit.
- `sv_cgiab/driver_cdkn2a_deletion` — "sort split reads to bottom": no such sort
  mode exists (sort options are position/strand/basePair/tag only). Feature request.

### Real backlog still UNCHANGED (verify with the hash script above)
- **ce11 maf gene-track requests** (`maf_codon_tooltip` [+width], `maf_color_by_chromosome`)
  need a hosted ce11 NCBI gene track — none in the ce_maf configs; only the
  hg38 470way pair had a usable track (MANE). `maf_inversions`/`maf_track`/
  `maf_conservation` are delete/keep judgment calls (maf_inversions is the ONLY
  figure documenting `showInversions`, used by both maf_track.md docs — don't
  blind-delete).
- **need new hosted data**: `variants/consequence_impact_sv` (ClinVar SV),
  `methylation/colo829_cram_and_bedmethyl` + `gallery/nanopore_methylation`
  (CpG-island BED), `methylation/chromatin_accessibility_6ma`, sv_cgiab
  `cnv_show_all_regions`/`cnv_with_bed_track` (real normalized depth vs indexcov).
- **app UI changes**: `plugin_store` (remove screenshots from the widget sidebar),
  `share_button` (dialog restyle concern).
- **synteny agent area**: `synteny_te_vapb_sva`/`_picalm_alu` (MANE on human+chimp
  — note MANE is human-only; chimp needs a RefSeq-Select equivalent),
  `synteny_human_chimp_cigar_modes`/`_colored`/`_transparent`.
- **still tractable next**: `alignments_sort_by_base` (2nd-stage sort broken),
  `multiway_synteny/ecoli_import_form` (simplify UI+blurbs), jbrowse-img specs.

## Remaining `bad` items (original notes, as of commit 1e0969b8fd)

### Tractable, no new data
- `alignments_sort_by_base` — 2nd stage no longer shows a sorted pileup; the
  sort action in the spec needs fixing.
- `alignments/modifications2` — reword the hard-to-read text blurbs.
- `introgression`, `introgression_locus` — add an annotation blurb explaining
  what the figure shows (archaic-segment rows).
- `gallery/sarscov2_polyprotein` — try `subfeatureLabels` below instead of
  overlapping; the NCBI GFF also shows duplicate polyprotein features.
- `gallery/hg002_dipcall` — shorten track-label names + `trackLabels: 'offset'`;
  also currently looks all-homozygous (pick a locus with het calls).
- `multiway_synteny/ecoli_import_form` — simplify both the UI shown and the
  blurbs (too complicated).
- `jbrowse-img/grape_peach_synteny` — confirm auto-diagonalize actually took.

### Need new hosted data / tracks
- `variants/consequence_impact_sv` — add a ClinVar SV (or other medical
  consequence) track.
- `gallery/nanopore_methylation` — add a UCSC CpG-island BED track.
- `methylation/chromatin_accessibility_6ma` — add chromatin-accessibility,
  promoter, and NCBI gene tracks alongside.
- `gallery/encode_multibigwig` — pick a more biologically interesting locus/data.
- `maf_codon_tooltip` — add NCBI gene track + widen the capture.
- `jbrowse-img/multisample_variants` — use human data + NCBI gene track.
- `jbrowse-img/alignments_snpcov` — use a real human-data example.
- `jbrowse-img/hic` — add NCBI gene track.
- `synteny_te_vapb_sva`, `synteny_te_picalm_alu` — swap the dense NCBI gene
  track for a RefSeq Select / MANE track on both human and chimp; `_vapb_sva`
  also wants a slight zoom-out.

### Coordinate with the synteny agent (their area — do not clobber)
- `synteny_human_chimp_cigar_modes` — make single-level, drop the 2nd frame,
  update caption.
- `synteny_human_chimp_colored`, `synteny_human_chimp_transparent` — reviewer
  says delete (but they compose `cigar_modes`; untangle first).

### Deferred by judgment (reviewer note is not a clear win)
- `inversion_long_read` — "potentially remove short reads"; **kept**, the
  short-vs-long contrast is the whole point of the figure/caption.
- `trio-matrix-phased-clean` — "unnecessary, use trio-matrix-phased"; **kept**,
  it's the *clean* (no-menu) matrix used by `multivariant_track.md`,
  `analyze_trio.md`, and the gallery — distinct from the menu-overlay
  `trio-matrix-phased`. Deleting it degrades those docs.
- `gallery/human_mito` — "refocus on a polyA-tail transl_except, or delete";
  needs a biology call.

## Shared-worktree caveat (important)

Multiple agents share this working tree. `website/scripts/screenshot-specs.ts`
and `website/scripts/screenshot-review.json` are **multi-agent dirty**. When
committing, scope to explicit pathspecs (`git commit -m .. -- <files>`); never
`git add -A` / bare `git commit`. Commit 1e0969b8fd deliberately left another
agent's `plugins/*`, `screenshot-review.json`, and a few `sv_cgiab/*` +
`track_menu.png` PNGs untouched. Because eslint reflows the whole spec file, a
foreign spec deletion (`translocation_open_from_track`) got bundled into that
commit anyway — unavoidable without hand-splitting hunks, and harmless (it was
already deleted in the working tree).
