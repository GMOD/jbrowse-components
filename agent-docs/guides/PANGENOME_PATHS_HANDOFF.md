# Pangenome graph paths: handoff

Per-haplotype paths through a pangenome graph, drawn in a linear view with
alignment-style indel glyphs. The analysis and the measurements behind the design
are in [TODO.md](../TODO.md) under "Linearize the pangenome"; this file is the
operational half: what exists, what to run, and what is still open.

## What shipped

**Data.** `scripts/build_minigraph_paths.sh` runs `minigraph -cxasm --call` per
assembly and projects the calls into one tabix-indexed BED, a row per bubble per
sample. Wired into `scripts/build_ecoli_pangenome_graph.sh` after the
`build_rgfa_tabix.sh` step. Hosted at
`jbrowse.org/demos/ecoli_pangenome/ecoli_minigraph_paths.bed.gz{,.tbi}`.
Five-strain E. coli: 601 bubbles, 3,006 rows, 38 KB.

The **header line is the contract** (`#chrom start end name score strand
thickStart thickEnd itemRgb strain class delta pathLen refLen alleles nonRef
path`), so other producers can fill the same schema; the script header lists
which. Columns 1-14 are stable — `alleles`/`nonRef` were inserted before `path`,
so `itemRgb` stays at 9 and existing configs kept working across that change.

**Display.** Two length-aware glyph passes, both an `OverlayCanvas` over whichever
backend painted the blocks plus a second call on the SVG export, neither touching
a shader:

- `LinearMultiRowFeatureDisplay`: `lengthField` slot +
  `rendering/drawMultiRowIndelGlyphs.ts`
- `LinearMultiSampleVariantDisplay` (the regular, non-matrix one):
  `showInsertionGlyphs` slot (shared schema, default on) +
  `components/drawVariantInsertionGlyphs.ts`

Both borrow `drawInsertionMarker` from `@jbrowse/alignments-core`, which is now on
its third consumer after alignments and maf. That package is the seam for glyph
geometry; add a consumer there rather than a display type. `884a126861` is the
counter-example: `MultiLGVSyntenyDisplay`, ~4,000 lines over 25 files with three
bespoke `.slang` shaders, deleted.

**Docs/figures.** `pangenome_ecoli.md` "Which strain takes which path" (+ the
filtering and limitations subsections), `pangenome/rgfa_strain_paths`, and a
paragraph in `pangenome_hprc.md` where it already explained the
insertion/reference asymmetry.

## Rules the glyph passes encode

Each was a wrong first attempt, so don't undo them:

- **Draw the bar only where it is wider than the block.** A same-colored bar
  inside a wide block is invisible overdraw; the label is what carries magnitude.
  The bar earns its draw at pure-insertion sites (no reference span, drawn 1 bp
  wide) and when zoomed out.
- **Keep the cell's own genotype color** in the variant pass, not the alignments
  purple. Color says which allele the haplotype carries; the marker only supplies
  length.
- **Only cells whose genotype carries the allele widen** (`cellCarriesAlt`), or
  the marker claims reference and no-call haplotypes have the sequence.
- `featureDeltas.length === featureStarts.length` is the multi-row "slot is set"
  gate. A zero delta is a legitimate reference-length allele, so presence cannot
  be tested per element.

## Traps in the `--call` data

- A bare `.` in the call's last field is **missing data**. Read as
  colon-separated it yields pathLen 0 and scores as a deletion of the whole
  reference span.
- `*` is an **empty path**, a deletion only where the bubble has reference span.
  72 of the 601 E. coli bubbles have none (pure insertion sites) and there `*` is
  the reference allele. Classifying on `delta` handles both; the `.` needs an
  explicit check.
- **The reference row is the pipeline's own check.** K12 comes out `ref` at all
  601 bubbles. If it ever shows an indel, suspect the FNR join before the biology.

## Verified facts (don't re-derive)

- Bubbles from `gfatools bubble` are **top-level and never overlap** (0 of 601),
  which is what makes one flat lane per strain complete rather than lossy.
- `strand` is **orthogonal to the length classes**: IAI39's 169 reverse-aligned
  calls split 60 ref / 57 del / 52 ins, so orientation is its own column.
- Reverse runs are long and contiguous (1,671,139-1,870,074 and nine others),
  i.e. IAI39's known large inversions, and no other strain has any.
- Allele spectrum: 436 biallelic bubbles, 105 with three alleles, 37 with four,
  23 with all five strains distinct.
- HPRC measurements (rank-1 donor hoovering, chain resolution, the non-symbolic
  `wave.vcf.gz`) are all in TODO.md with the tabix commands that produced them.

## Running it

```bash
# needs minigraph + bgzip + tabix; the cactus image has all three
docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
  quay.io/comparative-genomics-toolkit/cactus:v3.2.1 \
  bash /data/build_minigraph_paths.sh /data/graph.rgfa /data/out \
    /data/REF.pansn.fa /data/other.pansn.fa ...
```

The five-strain E. coli graph and its PanSN fastas are already built in
`~/ecoli_graph5/` (`ecoli_minigraph.rgfa`, `*.pansn.fa`), so a rebuild needs no
downloads and takes about two minutes.

**Deploying data.** Use `scripts/deploy-demo.sh <file> <demos-relative-path>`; it
uploads and invalidates CloudFront (`E13LGELJOT4GQO`) in one step. Invalidate the
`.gz` and the `.tbi` together, since a re-upload replaces both.

**`tabix <url>` writes the index into the current directory.** So after
re-uploading a file you had already queried, the next `tabix <url>` reuses that
stale local `.tbi` against the new remote data and reports
`Invalid BGZF header at offset N` plus `failed: No such file or directory`. That
reads exactly like a corrupt upload or a half-invalidated CDN, and it is neither.
Delete the stray `<name>.tbi` from the cwd (it also litters the repo root) and
re-run. The way to tell the difference in one step: `curl` the remote `.gz` and
`.tbi` to a scratch directory and run `tabix` on that local pair. If the pair
works there, the upload is fine and the index you are reusing is not.

**Regenerating the figure** needs a `pnpm build` in `products/jbrowse-web` first
(the generator renders the built bundle), then
`node --experimental-strip-types website/scripts/generate-screenshots.ts --filter
pangenome/rgfa_strain_paths --force`.

## The rGFA-only inventory (shipped)

`scripts/build_rgfa_alleles.sh <prefix>` reads `segs.bed.gz` + `links.bed.gz` and
writes `alleles.bed.gz`: one row per allele the graph holds, no assemblies, no
VCF, no graph file. Header is the contract (`… class delta altLen refLen rank
donor nested segments`). Plain BED, so a plain feature track packs it into rows;
deletions draw at true width, an insertion's size is its `name`.

How an allele comes out of the links index, and the three things that were wrong
on the first pass:

- **Deletions can be written backwards.** A backbone-to-backbone link with a
  coordinate gap is a deletion, but a reverse-orientation pair states the same
  skip with `tgt < src`. Requiring `tgt > src` silently dropped 4 of the 98 in
  the E. coli graph, including IAI39's at 1,072,931.
- **Walk bidirected, not by donor contig.** State is (segment, orientation) and
  each L-line also yields its reverse complement; that resolves all 745 entries
  (no dead ends, chains up to 35 segments). Pairing entry to exit by `SN` +
  donor offset — what TODO.md proposed off the windowed HPRC measurement — gets
  the branchy ones wrong: an undirected greedy walk left 16 dangling and picked
  arbitrarily at 130 branch points.
- **`nested` is a column, not a caveat.** 53 of the 845 E. coli walks pass a
  branch point, so their length is one route among several; the file says which.

**Validated against `minigraph --call` on the same graph**: 747 of that caller's
842 alleles come back with the identical delta inside the same bubble. All 95
residuals are compound routes at 69 nested bubbles, and every one sits at a
bubble the inventory does describe — nesting costs exact compound lengths, never
a site. The C4-window records also reproduce TODO.md's own HPRC measurements
(`s462766`, 1 bp, HG01952.1, bridging 31,984,683→31,991,051).

**Scale**: HPRC whole graph in 23 s / 1.7 GB from the two *hosted* indexes
(6.7 MB + 34 MB, no 2.6 GB GFA download): 208,308 alleles, 4.8 MB output.

**The BED carries a `CIGAR` column and loads as an `AlignmentsTrack`.** That
looks wrong and is the whole point: an allele is a mini-alignment against the
span it replaces (`2062M63348I`), so the alignments display packs the overlapping
alleles into rows and draws each insertion marker at its real magnitude. Drawn as
a plain feature track, a 63 kb insertion is a 1 bp box with the number in its
label — the exact defect this project exists to fix, so don't "simplify" it back
to a `FeatureTrack`. Verified in jbrowse-web on the shipped file: markers labelled
46,983 / 49,838 / 63,348 and a 3,217 bp deletion bar at K12 chr:1,094,197.

Two column names are load-bearing: `firstSeenIn` and `discoveryRank` were
`donor`/`rank` until the obvious misreading (a haplotype pileup) made the name
the place to carry the caveat.

## Any feature with a CIGAR now draws its indels

`extractFeatureArrays` gated CIGAR extraction on `isMismatchFeature`, i.e. on
`forEachMismatch`, which only BAM/CRAM features implement. So every non-BAM
alignment drew as a flat block — including every PAF/PIF track in an
`LGVSyntenyDisplay`, which is *the* display for assembly alignments in a linear
view. A 113 kb insertion in a contig alignment was invisible there, while the
two-row `LinearSyntenyDisplay` drew CIGAR indel tiles off the same data.

`extractCigarFeaturesFromString` closes it: `parseCigar2Typed` +
`forEachMismatchNumeric`'s `seqLength === 0` branch, which already emitted
exactly the ops needing no bases (I/D/N/S/H) and no mismatches. Both entry points
share one emit callback. Verified on the hosted E. coli all-vs-all PIF (its
`cg:Z` CIGARs do exist — a `tabix` returning nothing there is the stale-local-
`.tbi` trap below, not missing tags).

Also fixed alongside: `interbaseLengths`/`gapLengths` were `Uint16Array`, so any
insertion or deletion past 65,535 bp *labelled itself 65535* — Sakai's 113,174 bp
allele did exactly that on screen. Now `Uint32Array`; the GPU field was already
u32, so nothing downstream changed.

**Figure regeneration is not attributable in a shared worktree.** Regenerating
the synteny figure set here changed 13 PNGs, and the one inspected differed by a
"Longest isoform" chip from another agent's uncommitted config work, not by
indel glyphs. All were reverted. Regenerate figures only from a clean tree.

## Open
- **HPRC has no per-haplotype path track.** `--call` needs the 464 assemblies
  re-mapped, so HPRC stays on `wave.vcf.gz`, which now draws its insertions
  properly. Nothing to do unless someone wants that compute.
- **Nested variation is invisible** in this projection, by construction. If it
  becomes wanted, the tier already exists in the VCF's `LV`/`PS` snarl fields
  rather than in the graph route.
- The `path` column names exact segment ids but **nothing consumes it yet**. The
  obvious affordance is launching the graph view for one allele's segments, which
  lives in the external `jbrowse-plugin-graphgenomeviewer` where
  `RgfaTabixAdapter` is.
- `showInsertionGlyphs` sits in the **shared** variant schema because
  `stateModelFactory` is typed to `SharedVariantConfigModel`, so a subclass slot
  is invisible to `getConf`. The matrix display therefore inherits a slot it
  ignores. Widening that factory's config type is the real fix.

## Cross-references worth keeping

`~/src/vendor` has the tools this was checked against:

- **`gfabase`** (`src/schema/GFA1.sql`) validates the whole approach: its
  `gfa1_segment_mapping` projects segments to reference ranges, adds a *genomic
  range index* over `(refseq_name, refseq_begin, refseq_end)`, and keeps
  orientation in the tags. That is what `segs.bed.gz` and this paths BED do with
  tabix as the range index, so the schema idea transfers with no sqlite. Note its
  "one segment may have multiple mappings" — rGFA's single `SN`/`SO` per segment
  cannot express a segment recurring at two loci.
- **`pangyplot`** is the counterpoint on navigation: nested bubbles and chains
  from BubbleGun, a `/pop` endpoint to expand a bubble in place, `/skeleton` plus
  `ppbp`-parameterized `/detail-tiles` for level-of-detail, and `/pathorder` for
  haplotype ordering. Its `/path?...&sample=` is the same object this BED holds
  statically.
- `bandage`/`BandageNG` is the 2-D layout engine the graph view already borrows.
