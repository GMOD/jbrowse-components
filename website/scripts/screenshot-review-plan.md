# Screenshot review — agent handoff

Working the `bad`-status backlog in `screenshot-review.json` (tracked, so
verdicts are shared rather than local-only). **The json's `status` is the source
of truth, not this doc** — this doc is for pipeline mechanics and durable
gotchas, not a log of what's currently open. Extract the backlog with:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.note)"' \
  scripts/screenshot-review.json
```

## How the system works

- Specs live in `scripts/specs/*.ts` (aggregated by `screenshot-specs.ts`).
  `jbrowse-img`/CLI specs are in `screenshot-spec-helpers.ts`. One spec object
  per figure; `name` == the PNG path under `static/img/` (cli/jbrowse-img specs
  land in `products/jbrowse-img/img/` instead).
- PNGs are rendered by `generate-screenshots.ts` (puppeteer), run with `node`
  (**not** `npx tsx` — its `keepNames` injects a helper that breaks
  `page.evaluate`'d functions), from `website/`:
  ```bash
  node scripts/generate-screenshots.ts --filter <name> --exact --force
  ```
  - **Use `--force`.** The content-stable gate (see root `website/CLAUDE.md`)
    keeps the old PNG when a re-render differs by <0.5%, which silently skips
    small text/annotation edits.
  - The Bash tool's 2-min default timeout kills specs that fetch big remote data
    (1000g, cactus, celegans, cgiab) — pass a longer tool timeout (~400000ms).
    Concurrency is 4, so batch a few `--filter a,b,c` together, or pass your own
    `--localport` if another agent's regen is already running (default 3334 is a
    hard `EADDRINUSE`; `ps` first).
  - A code change to app/plugin **source** needs a rebuild first:
    `cd products/jbrowse-web && NODE_ENV=production node scripts/build.ts` (~a
    few min) — the generator renders the built bundle, not source. `--port=3000`
    proxies to a running dev server (`pnpm --filter @jbrowse/web start`)
    instead, which HMRs source edits with no rebuild — faster for iterating on
    plugin code, but the server must stay up.
  - `jbrowse-img`/CLI specs run `jb2export` from source via tsx (no build needed
    for `jb2export` src edits):
    `cd products/jbrowse-img && npx tsx --tsconfig ../../tsconfig.json src/bin.ts <args> --out /tmp/x.png`
    runs the bin directly so you see stderr the generator otherwise swallows.
  - Shaders: edit `.slang`, run `pnpm gen:shaders` (never hand-edit
    `*.generated.ts`).
- **Viewing PNGs**: capture is ~1500w@2x ≈ 3000px, too big for the Read tool —
  downscale first: `convert static/img/<name>.png -resize 1100x /tmp/x.png`,
  then Read `/tmp/x.png`. Whole-genome/many-row figures (470-way, dotplots,
  whole-chromosome coverage) are the worst offenders.
- Mark a verdict in `screenshot-review.json`: `status:"good"` + a fresh sha1 of
  the PNG (`isVerdictStale` only re-surfaces a `bad` verdict whose stored hash
  still matches the committed PNG — a changed PNG makes the note stop applying).
  Compute it with
  `crypto.createHash('sha1').update(fs.readFileSync(path)).digest('hex')`.
- Housekeeping after structural edits:
  - Changed a **gallery** spec's URL, or added/removed/renamed a spec →
    `pnpm gen:gallery-links` (CI gate: `pnpm gen:gallery-links-check`).
  - Added/removed a spec or a doc `<Figure>` → `pnpm audit-figures`.
  - `npx eslint --cache --fix scripts/specs/*.ts` — eslint reflows the whole
    file, which churns lines you didn't touch (inflates the diff, entangles with
    other agents' edits — see the worktree note below).

## The review log is largely stale — triage by PNG hash before touching anything

Most `bad` entries are already fixed or already deleted; the human just hasn't
re-reviewed. An item is only _genuinely_ still-bad when its committed PNG is
byte-identical to the hash the review was made against:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.hash)"' \
  scripts/screenshot-review.json | while IFS=$'\t' read -r name hash; do
  f="static/img/${name}.png"
  if [ ! -f "$f" ]; then echo "NOPNG (deleted)  $name"
  elif [ "$(sha1sum "$f" | cut -d' ' -f1)" = "$hash" ]; then echo "UNCHANGED (real) $name"
  else echo "changed (addressed?) $name"; fi
done
```

- **NOPNG** = spec+PNG already deleted. Resolved.
- **changed** = PNG differs from the reviewed one → the fix is likely already in
  the spec; verify by reading it rather than assuming the note is stale.
- **UNCHANGED** = the real backlog. Even then, read the whole note: often one
  sub-part is stale while another is still open.

## Shared worktree — important

Multiple agents share this working tree and commit concurrently. **Scope any
commit to explicit pathspecs (`git commit -m .. -- <files>`); never `git add -A`
/ bare `git commit`.** `screenshot-specs.ts`/`scripts/specs/*.ts` and
`screenshot-review.json` are multi-agent dirty essentially always — expect to
find another agent's in-progress edits there and leave them alone; `git status`
before editing, don't revert what you didn't touch.

## Useful facts learned (durable, not tied to any one session)

- **jbrowse-img (CliSpec) gene tracks: use `--hub <genome> --track <trackId>`,
  not a raw `--gffgz <url>`.** `--hub hg38` supplies the assembly (built-in
  refName aliases, no `--fasta`/`--aliases` needed) plus a bonus ideogram, and
  `--track hg38-ncbiRefSeqCurated` adds a pre-configured hosted NCBI RefSeq
  track. A raw UCSC `hg38.gff.gz` also carries RefSeqGene `match`/`region`
  features with no `Name` → they render as bare-UUID full-width bars. Find
  hosted trackIds with `jb2export list <genome> <filter>`. `--track` tokens
  stack above `--bam`/`--cram`/`--hic` in argv order (gene-on-top = list
  `--track` before the data track).
- **NCBI gene tracks already in `config_demo.json`** (no rehosting needed):
  `ncbi_refseq_109_hg38_latest` (hg38), `ncbi_gff_hg19` (hg19). Add the trackId
  as the first entry in the session `tracks` array.
- **View-as-pairs** = `linkedReads: 'normal'` in a `displaySnapshot`. The
  pairs→`insertSizeAndOrientation` coloring only auto-applies via the _menu
  action_, not on snapshot load — set `colorBy` explicitly in the snapshot too.
- **Dotplot init fields** (top-level in the session view object, routed to
  `init`): `autoDiagonalize: true`, `showColorLegend: false`, `colorBy`,
  `minAlignmentLength`. Same for `LinearSyntenyView` (`autoDiagonalize`,
  `colorBy`, `alpha`, `levelHeights`).
- **Arcs below coverage** = `readConnectionsDown: true` (the modern default).
- **The nested-bubble trap** (pggb/Minigraph-Cactus variant tracks): both emit
  top-level bubble records thousands of bp wide alongside the decomposed SNPs,
  one alt allele per sample. A single such record paints kilobases of flat solid
  color across the genotype rows and buries everything under it — that reads as
  a rendering bug but isn't one. Fix with a `jexl:` length filter on the
  genotype lane (e.g. `alleleLength(feature) < 100`); filtering on `end - start`
  instead doesn't work, an insertion consumes no reference so its span is 1.
- **Right-click hit-testing in a `stages` spec**: for a synteny/alignments
  track, only rows that actually paint a feature under the cursor return a
  context menu — a few px off (a band vs. the pileup row) returns nothing, which
  looks like "the feature is missing" rather than "wrong coordinate". Aim clicks
  at the widest/longest feature in view.
- `bcftools` in this sandbox is broken (`bcf_format_gt_v2`) — slice a remote VCF
  with `tabix -h <url> <region> | bgzip` instead.
- **Rebuilding the E. coli Minigraph-Cactus pangenome** (`~/ecoli_cactus5/`,
  `scripts/build_ecoli_pangenome_cactus.sh`): `cactus-pangenome` on the four
  genomes takes ~11 minutes; every downstream projection (halSynteny, hal2maf,
  taffy, odgi depth/pav/viz) finishes in ~15s total after that. Don't edit the
  build script while it's running — Bash reads it incrementally by byte offset,
  so an insert mid-run shifts everything after and can garble what it parses
  next, or silently not take effect.

## Hosted-track source: `~/src/jb2hubs/ucsc2jbrowse`

UCSC→JBrowse conversions, hosted at `https://jbrowse.org/ucsc/<asm>/<file>`
(relative track paths in `configs/<asm>.json` resolve there) plus some direct
UCSC URLs (`https://hgdownload.soe.ucsc.edu/gbdb/<asm>/...`). This is where to
find CpG-island / ClinVar / gene / repeat tracks for any UCSC assembly. Recipe:
`python3 -c "import json; d=json.load(open('configs/hg38.json')); ..."` to pull
a track's adapter, then verify the URL with `curl -sI`. Confirmed-good URLs:

- ClinVar CNVs (SVs):
  `https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarCnv.bb` (BigBed;
  autoSql fields incl. `clinSign`, `type`, `_varLen`, `_starCount`)
- CpG islands hg38: `https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz`
  (+`.csi`); `config_demo` also already has `cpgisland_ucsc_hg38` (UCSCAdapter)
- ce11 NCBI RefSeq: `https://jbrowse.org/ucsc/ce11/ncbiRefSeqCurated.gff.gz`
  (+`.csi`, index type CSI not TBI; chrom names chrI/chrII match the maf
  refnames)
- MANE Select hg38 (in `config_demo` as `MANE.GRCh38.v1.4.refseq`; or the BigBed
  at ftp.ncbi.nlm.nih.gov). Cleanest gene track for hg38 (one transcript/gene).
  Reusable spec consts in `specs/maf.ts`: `HG38_MANE_TRACK`, `CE11_GENE_TRACK`.

To add an out-of-config track, switch the spec from `lgvSession` to
`sessionSpec` with `sessionTracks: [...]`. If an over-dense track needs
thinning, use `jexlFiltersSetting: ["jexl:...", ...]` on its display snapshot
(ANDed).

## Known blockers (check `screenshot-review.json` for current status first)

- `jbrowse-img/multisample_variants` — `jb2export`'s static SSR renders the
  per-sample genotype matrix **empty** for the 1000G phase3 callset (volvox's
  simpler path works); a real fix needs a `jb2export` matrix-render bug chase.
  Real pop data is also ref-dominant (grey) — the compelling view is
  `colorBy:'population'`, which needs a `samplesTsv:` jb2export CLI feature.
- `alignments_sort_by_base` — no sort mode sorts split reads to the bottom;
  current sort options are position/strand/basePair/tag only. Feature request,
  not a spec bug.
- `read_vs_ref_insertion`'s "drop protein-translation/showReverse/legend from
  launched read-vs-ref synteny by default" note is an app-default change in the
  synteny-launcher code, not a spec edit — the figure loads a saved remote
  session that already bakes those settings on.

## Pangenome graph figures: the plugin publish loop

The plugin lives in `~/src/jb2plugins/jbrowse-plugin-graphgenomeview`, and the
three `test_data/graphgenomeview/*.json` configs pin `esmUrl` to a
content-addressed prefix, so **a plugin change reaches no figure until it is
published**. The loop, all three steps or none:

```bash
cd ~/src/jb2plugins/jbrowse-plugin-graphgenomeview && pnpm betabuild   # prints the hash
sed -i 's|graphgenomeviewer/<old>/|graphgenomeviewer/<new>/|g' test_data/graphgenomeview/*.json
cd website && node scripts/generate-screenshots.ts --force --filter pangenome/
```

`betabuild` uploads to the public `s3://jbrowse.org/demos/graphgenomeviewer/`,
moves the unversioned entry point the published figures' live links resolve, and
invalidates CloudFront — **ask before running it.** Last published
`ae1aa4cabf9e` (2026-07-27).

## Choosing a pangenome locus from the data, not from a locus list

Both graphs ship an index that answers "where does this graph say the most", and
scoring it beats picking a gene and hoping. The scripts below were written
against local copies (`curl` the `.bed.gz` once; the HPRC bubbles file is 60
MB).

- **HPRC** (`jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz`): one
  row per bubble, `col4` = segments, `col5` = paths, `col7`/`col8` = min/max
  allele length. Rank by max allele length **and** cap segments — the top of the
  unfiltered list is centromeric and acrocentric hairballs (chr7 61.1 Mb, chr14
  105.5 Mb, KIR at 209 segments in one bubble), and a picture a reader cannot
  follow argues nothing. Scored candidates, all verified against RefSeq:

  | Locus       | Bubble                         | Segments / paths | Alleles       |
  | ----------- | ------------------------------ | ---------------- | ------------- |
  | LPA KIV-2   | `chr6:160,606,991-160,639,012` | 33 / 584         | 4.3 - 176 kb  |
  | CFHR3/CFHR1 | `chr1:196,753,088-196,837,771` | 28 / 721         | **0** - 88 kb |
  | AMY1        | `chr1:103,611,080-103,732,636` | 95 / many        | up to 317 kb  |
  | SMN1/SMN2   | `chr5:70,996,742-71,121,626`   | 27 / 1089        | up to 376 kb  |
  | FCGR2/3     | `chr1:161,514,686-161,596,343` | 20 / 257         | up to 84 kb   |
  | HP/HPR      | `chr16:72,049,451-72,076,250`  | 10 / 9           | up to 27 kb   |
  | CYP2D6      | `chr22:42,123,461-42,139,682`  | 3-14 / 2-13      | up to 27 kb   |

- **E. coli rGFA** (`ecoli_minigraph.segs.bed.gz` + `.links.bed.gz`): seed from
  the K12 rank-0 segments in a window, BFS the links, and group the rank>0
  segments into connected runs. The largest run is 148 kb at K12
  1,196,217-1,223,579; the densest 50 kb window is 2,030,000-2,080,000, where
  CFT073 contributes 116 kb at the `asnT`/`asnW`/`asnU`/`asnV` tRNA loci — the
  classic pathogenicity-island integration sites, and an unused figure.

### A deletion has nowhere to be drawn — do not spend a session on this again

CFHR3/CFHR1 above is the better _story_ (two named genes a fifth of haplotypes
do not carry, protective for AMD, a risk factor for aHUS). All three displays
were tried and none of them show it:

- **sample rows** — a deletion contributes no segment, so a carrier's row is
  empty and reads identically to a haplotype the window says nothing about;
- **anchored** — what it does contribute is an edge between two rank-0 segments,
  which the layout draws flat along the backbone row, underneath the backbone;
- **the 464-haplotype callset** — the bubble's own top-level record is alt for
  nearly every haplotype (the nested-bubble trap), so the lane washes solid blue
  and says "everyone differs here", not "these carry the deletion";
- **the allele inventory** — draws it correctly, as two grey bars. True, and not
  a figure.

`hprc_lpa_kiv2` is the same scan's best _expansion_, and expansions draw fine.
Making the deletion legible is a product change (a per-haplotype presence
channel), not a spec edit.

## Open plugin work

- **Edges attach to the end the GFA link names.** `computeEdgeCurves` always
  leaves the from-node's last point for the to-node's first, but
  `L s2087 + s378 -` attaches to `s378`'s RIGHT end, so on a reverse-complement
  link the edge is drawn backwards past the segment it rejoins — the three
  crossed bubbles `bubbleCrossing.test.ts` still excludes. Proven by re-running
  that check with each edge attached to whichever ends face each other: 3
  crossings to 0. Needs the link strands carried onto `GraphEdge`
  (`fromAtHead = strand1 === canonical(from)`,
  `toAtTail = strand2 === canonical(to)`), each node's drawn orientation
  relative to the reference propagated through the run in `placeOffReference`,
  and `computeEdgeCurves` picking endpoints from those. Then tighten the test
  back to a bare `expect([])`.
- **A per-strain launch opens on `No tracks active`.** `showInLinearView` only
  carries the graph's own track across, and that is configured for the reference
  alone, so `Launch view` → `CFT073 chr:…` lands on an empty view. That is why
  `rgfa_launch_out_menu`'s second frame is the synteny launch and not a strain.
