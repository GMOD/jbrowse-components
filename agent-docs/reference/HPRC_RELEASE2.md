---
name: hprc-release2
description: What HPRC release 2 publishes and which artifacts JBrowse opens — the v2.0 TAF, pairwise PAF unpacked from the graph's walks, and the measurements not to re-derive. Read before touching the pangenome MAF or synteny path.
audience: internal
kind: dataset
---

# HPRC release 2 in JBrowse

The alignment and MAF side of the HPRC data. The graph view's own queue lives in
the graph plugin's repo (`jbrowse-plugin-graphgenomeviewer`, its `IDEAS.md`).

## What HPRC publishes, and what opens

| artifact | opens? |
| --- | --- |
| `v2.0/…/hprc-v2.0-mc-grch38.full.taf.gz` + `.tai` | yes, `BgzipTaffyAdapter`; a quarter of the MAF's bytes per locus |
| `v2.1/…/hprc-v2.1-mc-grch38.full.maf.gz` + `.tai` | yes, `BgzipMafAdapter`; the tutorial's file |
| `sv.gfa` (minigraph rGFA) | yes, graph view plugin |
| `wave.vcf.gz` | yes, genotype matrix |
| `hprc25272.aln.paf.gz` and the per-target `impg/pafs/all-vs-1/` split | in principle, but sparse all-vs-all and unsorted (below) |
| `hprc465vsgrch38.aln.paf.gz` | yes, but a star (below) |
| per-chromosome pggb `.gfa.zst` | no (below) |
| impg TPA | no reader |

The bucket serves `Access-Control-Allow-Origin: *` with `Content-Range` exposed,
so browsers can range-request all of it.

## The v2.0 and v2.1 builds differ

- v2.0 publishes the alignment as TAF and v2.1 as MAF, never both. Both index
  the same 195 GRCh38 contigs and name sequences `GRCh38.chr6`. The v2.0 TAF
  header is `#taf run_length_encode_bases:1 version:1`, which
  `BgzipTaffyAdapter.ts` handles.
- v2.1 is a re-run, so its alignment differs in content, not just packaging: its
  README (`…/minigraph-cactus/v2.1/README`) lists per-chromosome minigraph
  construction and centromeres patched to align with rCRS. It also fixes a
  sample-name typo in `sv.gfa.gz` and a vcfwave missing-genotypes bug. Check
  this before treating a v2.0 oddity as a JBrowse bug.
- At C4, which build is right is not settled: C4 is copy-number variable, so a
  haplotype with a different copy count has no single correct projection onto
  GRCh38.
- The flat `wave.vcf.gz` predates the one under `v2.0/` (a later rewave). The
  tutorial still points at the flat one.
- The fetch gate measures `queryBlockSpan` over the buffered region against the
  display's 5 MB default. At the tutorial's C4 locus both formats draw without
  `fetchSizeLimit`. The MAF costs range: its alignment tier passes 5 MB at a
  much narrower view than the TAF's. `queryBlockSpan` and `bytesForRegions` hold
  the numbers.

## Measured findings

**impg's PAF output is projections, not compositions.** `impg query -x -o paf`
returns "PAF-like projected interval matches" anchored on the sequence queried,
so on the vs-GRCh38 star a query returned zero rows pairing two non-reference
haplotypes, and `impg query -o paf | make-pif` reproduces the star it was given.
A-vs-B through impg means `-o fasta` and realigning, or `-o maf`/`-o gfa`. impg
suits extracting a locus across a cohort, not generating pairwise alignments.

**`hprc465vsgrch38.aln.paf.gz` is a pure star.** Every row targets GRCh38, so a
band between two non-reference assemblies is empty by construction. Both
all-vs-all adapters throw `noSuchPairError` rather than drawing an empty band.

**`hprc25272.aln.paf.gz` does not hold every pair either.** It stores about 54
haplotype partners per target of 464, and an unordered pair has a direct CIGAR
about one time in five. A stack whose adjacent rows are chosen on biology mostly
lands on unstated pairs, so `build_amylase_haplotypes.sh` aligns each pair with
minimap2. Where the pair is stated, wfmash chains still break at a copy-number
array. The per-target files are BGZF but not sorted by target position, so an
index alone cannot make them range-requestable.

**A composition tool for this was built and deleted** (`jbrowse transitive-paf`,
`a2858d0c86` → `79080af254`). Do not rebuild it: three stacked rows need only two
bands (order the reference between them), a locus cut aligns pairwise in
seconds, and beyond that a pangenome is a multiple alignment.

**The per-chromosome pggb graphs do not fit in memory.** `pggb_gfa_to_bed.py`
holds every segment, link and path step at once, so it scales with the graph and
not the window; chrY, the smallest, exhausted a 30 GB machine. For human, use
`odgi extract` on a window or the minigraph rGFA.

**The published MAF is tab-separated.** UCSC writes space-aligned MAF; taffy and
Cactus write tabs. A ` +` split leaves each row in one field, so every block
silently vanishes and the track draws nothing without erroring.
`util/mafLines.ts` splits on `\s+` (`WHITESPACE_REGEX`).

**taffy dies on a byte-cut slice.** A truncated last MAF block trips
`maf_read_block`'s assertion, and a headerless mid-file TAF range segfaults. Cut
at a block boundary.

**`maf2bed` needs v0.6.0 or newer for `--summary`.** v0.5.1 ignored the unknown
flag, exited 0 and wrote nothing.

## Unpacking pairwise alignments from the graph

`demos/hprc_multiway` draws eight haplotypes against GRCh38 out of the graph's
own alignment, not the impg PAF. Nothing is aligned and no aligner setting is
chosen, so the build is reproducible from the published file. Two routes in
`scripts/build_hprc_multiway_synteny.sh`:

- **GFA (`SOURCE=gfa`, the default).** `scripts/gfa_to_pairwise_paf.py` reads a
  haplotype's alignment to any chosen reference off the walks: two walks through
  one node are identical sequence. No taffy, and no `-r` range that refuses chr1
  and chr2. `PANGENOME_GRAPHS.md` §"Pairwise alignments unpacked from the GFA"
  holds the chaining rules and the E. coli agreement.
- **TAF (`SOURCE=taf`).** Streams the v2.0 TAF per chromosome through
  `taffy view -m` into `scripts/maf_to_pairwise_paf.py`.

Both converters take `--max-gap 10000`. Cactus blocks tile the reference but the
projection drops query insertions between blocks, so exact chaining splits a
record at every one-base jump and the graph unpacks to ~10 kb pieces. A 10 kb
bridge (an `I`/`D`) matches `make-pif`'s coarse bound, so both tiers agree on
where an alignment is discontinuous. Names come out PanSN
(`HG01109#1#JAHEPA020000012.1`). `scripts/maf_to_pairwise_paf.test.ts` works a
four-block fixture by hand.

**taffy refuses chr1 and chr2 at full length** with the same "not found in taffy
index" as a range past the contig's end. `tai_iterator` bounds its scan by the
index record after the range end, and for chr1 and chr2 that successor
(`chr10`, `chr20`) sits earlier in the file. The script retries capped at the
last index entry and reports the dropped bp (a telomeric N run).

**Without `--contig-lengths`** every chromosome-scale contig comes out a few kb
short, because minigraph-cactus clipped telomeres out of the walks.

**A haplotype pair needs no 63 GB download.** `gbz-base-query` with
`--haplotype-index` and `--stack` fetches one window and prints each row against
the next as PAF; a shared node is a run of `=` and the bases between get the best
global alignment under vg's scoring.
`scripts/build_graph_haplotype_stack.sh` wraps it into a stacked
LinearSyntenyView config (`test_data/hprc_c4_stack`, figure
`multiway_synteny/hprc_c4_graph_stack`). Do not use the reader's `--cigar`
(sizes the stretch between shared nodes as one `M`) or `gfa_to_pairwise_paf.py`
on a `--format gfa` window (pairs it as `X`) for a haplotype pair: neither
compares bases. At the amylase locus the graph folds paralogs onto shared nodes,
so the pair fragments whichever tool reads it.

**Agreement.** The GFA, TAF and impg routes agree on the CFH window the demo
opens on (`chr1:196,700,000-197,000,000`): the four CFHR3/CFHR1 deletion carriers
break in all three, and the graph puts every carrier's break at the same
coordinates because they traverse one bubble, where wfmash extends each row into
the flanking duplication by a different amount. The graph has one row where
impg's rows overlap, since a base sits in one block. Genome-wide, graph-derived
union coverage is 98.6-99.1% of impg's at higher identity, and the GFA `=` total
matches the TAF's to 0.011%. They differ in how private bp are written (the GFA
pairs them as `X` first) and in record length, since a chain runs through what a
MAF block boundary split.

**Hosting.** `jbrowse.org/demos/hprc_multiway/` holds the impg files, the
TAF-route files (`hprc_multiway_graph.*`) and the GFA-route files
(`hprc_multiway_gfa.pif.gz{,.csi}`, `<sample>.<hap>.gfa.chrom.sizes`,
`README_gfa.txt`). `demos/hprc_multiway/config.json` serves the GFA build.
`UPLOAD=1` copies data files and skips any key already there; the README goes
through `deploy-demo.sh`. The hosted GFA file came from release 2.1's graph
(the script's default `GFA_URL`); `README_gfa.txt` beside it carries its counts.

## The zoom-out tier

`jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.summary.bed.gz` is the whole-genome
summary tier for the v2.1 MAF, wired by `test_data/hprc_maf_summary.json` and
rebuilt by `scripts/build_hprc_maf_summary.sh`, whose header carries the
surviving failure mode. A whole-chromosome read costs tens to low hundreds of kB
against a 5 MB budget, where the MAF alone is refused on whole chr6 (billions of
bytes by `queryBlockSpan`). The alignment tier stays the better view wherever it
is affordable, such as the tutorial's C4 window.

**The tier is a separate config, not switched on for `hprc_maf.json`.** The
summary swaps on span (`coarseTierPastThreshold` is `aboveForceLoadFloor`, 20
kb), while the question it stands in for is cost. The tutorial's 83 kb C4 figure
would silently lose its per-haplotype base rows to presence bands (verified:
`coarseTierActive: true` with the summary configured). A cost-based swap is a
design question, since the deciding estimate is the detail tier's, which
`byteGateAdapterConfig` points away from once the tier is on
(`gateMeasuresCoarse`). [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md) §"Fetch dominates at
470-way" predicted this gap.

Traps in the summary build, none specific to HPRC:

- **`taffy view -r` fails silently on a range past the contig's end**: stderr
  message, empty MAF, exit 0. A harness that discards stderr and tests
  `[ -s file ]` passes a summary holding only its header; one such build lost 93
  of 195 contigs, chr1 and chr2 among them. A per-chromosome table catches it; a
  genome-wide total hides it. The build is now one sequential pass that never
  asks the index.
- **A contig with a single `.tai` entry cannot be extracted by region.** That
  was a taffy limit, not evidence the alignment lacked the contig.
- **`--merge-gap` is not the lever for row count.** In segmental duplications a
  haplotype aligns to one reference interval more than once, so runs overlap and
  there is no gap to close. Collapsing each haplotype's overlapping runs into
  their union cut chr14 from 900,414 rows to 9,089. That belongs upstream in
  `maf2bed`.

## What the `LV==0` filter costs

The wave VCF is vcfwave-decomposed, so the tutorial teaches `LV==0` to keep the
top-level record and not paint one event at two positions. Over
`chr6:32,450,000-32,650,000` it drops 22 records on the >=50 bp tier, 18 of them
naming an `ORIGIN` in the same window.

The cost is a span collapsing onto a column. A parent sits at one position while
its children spread over its span, so a window can lose all its records to a
parent drawn elsewhere: three consecutive windows across CYP21A1P and TNXA (the
most variable part of C4, `chr6:32,000,000-32,020,000`) hold 76, 170 and 103
records and none with `LV==0`. That is why `maf_hprc_pangenome`'s callset lane
runs unfiltered. A blank column under `LV==0` is a statement about the snarl
tree.

The sparse right third of `pangenome/hprc_graph_vs_callset` is not the same
artifact: the >=50 bp tier really is thin there, and dropping the clause would
double-paint events to recover mostly absent texture. Do not re-derive.

## Short-read copy number at C4

A lane of 1000 Genomes QuicK-mer2 copy number agreed with the alignment at C4
and was removed from `maf_hprc_pangenome` as a confusing third cohort. Over
`chr6:32,005,691-32,011,057` the depth call equals `2 - (unaligned haplotypes)`
for thirteen of fourteen samples, so a unique-k-mer estimator is not noise even
where RCCX repeats. Only depth shows gains: an extra tandem module collapses
onto its own reference span and draws the same row as one copy. If a figure
needs gains, this is the lane.

## Related

- [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md) §"A `.tai` is not a tier": why both
  MAF adapters take a `summaryAdapter` slot.
- [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md) §"The worker pipeline": what one
  region costs after the bytes arrive.
- [PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md): the graph side of the same data.
