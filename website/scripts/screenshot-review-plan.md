# Screenshot review — handoff for the next agent

Continues the screenshot-review cleanup. `screenshot-review.json` is the review
log (tracked in git but "local coordination only" — **do NOT commit it**, leave
it working-tree-dirty). Each entry's `note` is the reviewer's ask; `status` is
`good`/`bad`. **The json's `status` is the source of truth** — this doc goes
stale, so trust the json over it.

## How the system works (read first)

- Specs live in `website/scripts/screenshot-specs.ts`. One object per figure;
  `name` == the PNG path under `website/static/img/` (cli/jbrowse-img specs land
  in `products/jbrowse-img/img/` instead).
- PNGs are rendered by `website/scripts/generate-screenshots.ts` (puppeteer).
  From `website/`:
  ```
  node --experimental-strip-types scripts/generate-screenshots.ts --filter <name> --exact
  ```
  NOT `npx tsx` (its keepNames breaks `page.evaluate`). Add `--force` to rewrite
  even a near-identical PNG (default only writes on >0.5% pixel diff — an
  unaffected spec re-renders byte-identical and logs `≈ kept`).
- **Two render paths for URL-mode specs:**
  - default = the **built** `products/jbrowse-web/build` bundle. A change to app
    or plugin **source** needs a rebuild first:
    `cd products/jbrowse-web && NODE_ENV=production node scripts/build.ts` (~a
    few min; reliable in-sandbox, this is what I used this session).
  - `--port=3000` = proxy to a running dev server
    (`pnpm --filter @jbrowse/web start`), which HMRs source edits with no
    rebuild — faster for iterating on plugin code, but the server must stay up.
- **cli/jbrowse-img specs** run `jb2export` from **source via tsx** (no build
  needed for jb2export src edits), output to `products/jbrowse-img/img/`. Run
  the bin directly to see stderr the generator swallows:
  `cd products/jbrowse-img && npx tsx --tsconfig ../../tsconfig.json src/bin.ts <args> --out /tmp/x.png`
- **Viewing PNGs**: capture is ~1500w@2x ≈ 3000px, too big for the Read tool.
  Downscale: `convert static/img/<name>.png -resize 1100x /tmp/x.png`, then Read
  `/tmp/x.png`. Whole-genome/many-row figures (470-way, dotplots) especially.
- Shaders: edit `.slang`, run `pnpm gen:shaders` (never hand-edit
  `*.generated.ts`).
- `isVerdictStale` only re-surfaces a bad verdict that HAS a `hash`; to mark
  something good set `status:"good"` + a fresh sha1 of the PNG (node:
  `crypto.createHash('sha1').update(fs.readFileSync(path)).digest('hex')`).

## Shared worktree — IMPORTANT

Multiple agents share this working tree and commit concurrently (HEAD moved
under me mid-session). **Scope any commit to explicit pathspecs; never
`git add -A`.** Nothing from this session is committed. Files dirty from OTHER
agents (not mine):
`website/docs/user_guides/{alignments_track,hic_track,gc_content_track}.md`,
root `package.json`/`pnpm-lock.yaml`/`.github`, etc.

## Done this session (uncommitted) — the big one was a real bug

**MAF fit-mode render regression (root cause + fix).** The MAF overlay
components read the RAW `rowHeight` MST prop, which is **0 in fit-to-height
mode** (what `heightOverride` uses, post the heightOverride→config-height-slot
migration), instead of the resolved `effectiveRowHeight`. `rowBandGeometry(0)` →
`bandH 0` → `fillRect(...,0)` paints nothing. This silently **blanked** the
identity heatmap and color-by-chromosome rows in BOTH the on-screen canvas and
SVG export (the GPU base/SNP path was fine — it already used
`effectiveRowHeight`, which is why only these overlays broke and the committed
PNGs looked "stale"). Fixed to use `effectiveRowHeight` in:
`MafRowIdentityCanvas.tsx`, `MafSourceChromCanvas.tsx`,
`LinearMafDisplayComponent.tsx` (row labels + tooltip/subsequence hit-test,
which divided by 0), and `renderSvg.tsx`. **If a MAF overlay is blank only in
fit mode, this is the class of bug.** All 8 maf PNGs were broadly stale and were
regenerated.

Other done items (flipped `good` or deleted in the json):

- **chromhmm** — new `docs/tutorials/chromhmm.md` (how the multirow-bigBed
  ChromHMM config is built + `LinearMultiRowFeatureDisplay`
  partitionField/color/rowOrder). Linked from `introduction.md`; guide index
  regenerated via `pnpm lint-docs`.
- **maf_codon_translation**, **sv_cgiab/cnv_calibration** — DELETED (spec +
  PNG + doc refs + json entry).
- **maf_470way** — regression fixed + shortened (`heightOverride` 1080→560) +
  NEW `MafIdentityLegend.tsx` (top-right Divergent/Conserved, reuses the
  `MafLegend` scaffold + `identityColor`).
- **maf_color_by_chromosome** — reworked the global name→hue **rainbow** into a
  PER-ROW rank scheme: `perRowChromRanks()` + `SOURCE_CHROM_PALETTE` in
  `drawSourceChrom.ts` (rank 0 = each row's main chromosome = primary blue; a
  block from a different source chromosome = orange/crimson accent =
  rearrangement signal). Legend getter renamed
  `visibleSourceChromosomes`→`sourceChromLegend` (rank-based). Removed old
  `chromosomeColor`; test rewritten; user+config guide prose/captions updated.
  maf tests green (299).

## 2026-07-03 session — resolved

Cleared 11 of the then-13 bad items (json is the source of truth):

- **gc_content** — already on H. pylori w/ GC skew; approved as-is.
- **variants/consequence_impact**, **maf_cds_frames** — stale entries (spec+PNG
  already deleted); removed from the json.
- **consequence_impact_sv** — zoomed out to ~450kb.
- **sv_cgiab/{driver_cdkn2a_deletion, driver_kras_gain, driver_smad4_loh}** —
  cdkn2a: linked supplementary reads + dropped redundant log2 track; kras: gene
  track + CN 3 (2|1) label + zoom-out; smad4: CN labels + folded BAF.
- **sv_cgiab/{cnv_log2_baf, cnv_log2ratio_genome}** — switched BAF to the
  **folded** track (`HG008-T_baf_folded.bw`, avg mode). It already exists
  genome-wide (smad4 used it), so this was unblocked — LOH now reads as a clean
  elevated band. (The reviewer's "align tick labels always-right, SVG=left" is a
  separate GLOBAL wiggle YScaleBar-position change, NOT done — flagged for a
  dedicated pass; current render already shows all ticks left, consistently.)
- **maf_470way_codon** — root-caused + FIXED. The blank codon columns were
  reference codons whose 3 bases **straddle a MAF alignment-block boundary**,
  dropped by the old single-block `codonColumns` (coverage is per-base so it
  didn't gap — hence the mismatch). `computeVisibleCodons.ts` now resolves each
  codon position across blocks (`locateCodon`/`rowCodonBytes`) and stitches the
  codon from both, respecting per-block species membership. 3 new cross-block
  tests. See memory `key_pattern_maf_codon_block_straddle_gap`.

**Config change**: added `hg008_cnv_calls` (CN-labeled CNV BED) + a hg38 RefSeq
gene track (`hg38_ncbiRefSeq_ucsc`) to the DEPLOYED
`jbrowse.org/demos/cgiab/config.json` (rclone upload as user `cmdcolin` +
CloudFront invalidation of `/demos/cgiab/config.json`), synced the local
`cgiab-demo-config.json`, and switched cdkn2a/chr17/kras/smad4 to reference them
by id. Backup of the pre-change config is in this session's scratchpad.

**tree 1px clip** (maf_inversions): `TREE_LEFT_PAD` 1→2 in
`packages/tree-sidebar/src/hierarchy.ts` (root stroke now a clear px off the
edge). Shared by all tree figures, but the 1px shift is sub-`--diff-threshold`
for most, so only `--force`-regen'd figures change; other tree figures'
committed PNGs (+ their verdicts) stay valid until a future full regen.

## Still `bad` — deferred as design/blocked (user chose to defer)

- **inverted_duplication_bezier** — design: make the bezier more dramatic, add
  read-pair arcs, and color the grey supplementary-chain segments. Alignments-
  rendering feature work.
- **maf_inversions** (structure-only cue) — inversions are hard to see; wants a
  specialized "structure-only" view. The 1px tree clip half of this note IS
  fixed (above); the "hard to see" half is deferred design work.
- **jbrowse-img/multisample_variants** — blocked on code: jb2export static SSR
  renders the per-sample genotype MATRIX **empty** for the 1000G phase3 callset
  (volvox's simpler path works) → needs a jb2export matrix-render fix. AND real
  pop data is ref-dominant (grey); the compelling view is `colorBy:'population'`
  needing a `samplesTsv:` jb2export CLI feature. bcftools in this sandbox is
  broken (`bcf_format_gt_v2`) — slice 1000G with `tabix -h <url> <region> |
  bgzip` (refnames unprefixed `1`; hg19.fa.gz also `1`).

## Workflow

Edit spec/code → (`pnpm gen:shaders` if shader; rebuild jbrowse-web if
app/plugin source) → regen `--filter <name> --exact --force` → downscale + Read
the PNG to verify → set `status:"good"` + fresh sha1 in
`screenshot-review.json`. Run `pnpm test plugins/<x>` for any plugin code you
touch. Keep commits pathspec-scoped.
