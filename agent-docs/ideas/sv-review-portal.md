---
name: sv-review-portal
description: A static review page over a whole SV callset in the shape of gene-review-portal — one card per record of `jb2export batch --manifest`, tumor over normal, grouped by the caller's VCF `EVENT`, sorted by read support, with a verdict and a live link. Where a caller or an assembler wrote a contig BAM, the card's allele row draws that contig against the reference through "Linear read vs ref", which no spec, URL or `jb2export` mode reaches yet. ADR-140 deleted the chain finder the first plan stood on, so every grouping here is the caller's.
---

# SV review portal

Agreed with Colin 2026-08-27 and again 2026-09-20; parked because v5.0.0 does
not turn on it. `sv_callset_review` renders a callset into a directory of
images, and
[gene-review-portal](https://github.com/cmdcolin/gene-review-portal) turns a
directory of images into a queue a person can finish: filters, keyboard
verdicts, TSV export, a live link per card. The SV portal is those two joined.

The first plan built its cards from `sv_multihop.py chains`.
[ADR-140](../architecture-decision-records/adr-140-sv-analysis-is-not-ours-to-ship.md)
deleted that script, so a card groups junctions only where the caller did, and
[ADR-137](../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)
means a card draws an allele only where a tool outside JBrowse built one.

## What a card is

One record of the callset, which is one row of `jb2export batch --manifest`:

- **Evidence row**: tumor above normal at the record's loci, split alignments
  with curved connectors for a junction, the plain pileup for a record one
  window holds. `batch` already picks between the two. On COLO829 that is 82
  two-panel images and 53 one-panel ones, 11 of them records naming a single
  locus.
- **Allele row**, where a contig exists: the contig against the reference, see
  [below](#the-allele-row-is-a-bam-record).
- **Facts**: the record's own VCF columns — `SVTYPE`, `SVLEN`, `FILTER`,
  `QUAL`, `EVENT`, `EVENTTYPE` — and the counts under
  [Sorting the queue](#sorting-the-queue-is-what-makes-it-finishable).
- **Verdict**: confirmed / needs a look / artefact, kept in the browser and
  exported as TSV, as gene-review-portal's `app.jsx` does. Nothing writes a
  FILTER or a genotype.
- **Live link**: a `BreakpointSplitView` or `LinearGenomeView` session spec over
  the manifest's loci and the run's tracks.

A caller's `EVENT` is a property of a card and a filter over the queue, and the
manifest's `event` column carries it. An event visiting more than two loci also
gets one card of its own from `batch`'s `event_<n>_<label>` image, every locus
in one picture, which is the static form of the SV inspector's **Open every
locus of**. On the HG008-T benchmark that is 10 of its 17 `EVENT` values at a
600 bp flank, from 3 panels to the 10 of `cluster_6`.

## The allele row is a BAM record

The cancer_sv demo draws der(3) in synteny mode from a second assembly, a PIF, a
segments BED and a realigned BAM: four hosted files and a config entry for one
allele. A callset of a hundred events cannot take that route.

Callers and assemblers already write the same information as one ordinary BAM
of contigs, which JBrowse opens as an alignments track:

| Producer | File | How a record finds its contig |
| --- | --- | --- |
| sawfish | `contig.alignment.bam` | QNAME is the VCF ID up to its third number |
| GRIDSS | `<out>.assembly.bam`, contigs as soft-clipped reads with `SA` | `BEID` |
| SvABA | `<id>.contigs.bam` | by position |
| a local assembly | `minimap2 -a ref.fa contigs.fa` | by position |
| a whole-genome assembly | the same | by position |

"Linear read vs ref" (`buildReadVsRefSpec`) draws one BAM record against the
reference as a synteny view over a temporary assembly, from the record's CIGAR,
`SA` tag and sequence. It reads what an aligner wrote and infers nothing, so it
passes the three questions in
[reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) §"The line this feature
does not cross". The only way in is a read's context menu. No session spec, URL
parameter, `jb` call or `jb2export` mode reaches it, so a tutorial cannot link
one and a portal cannot render one.

The piece to build is that launch: a `LinearSyntenyView` named by a track, a
record name and a locus to find the record at. The SV inspector's row menu, the
portal's allele row and an agent all take it from there.
[route-as-a-launch-input](route-as-a-launch-input.md) stays the answer for a
structure with no sequence behind it: a LINX derivative chromosome, a gGnome
walk, a GATK-SV `CPX_INTERVALS`.

## Test drivers

**HG008-T (C-GIAB), because it carries `EVENT`.** The V0.5 draft benchmark
(`GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz`, 210 records)
tags records with `EVENT` and `EVENTTYPE`: 15 events of two or more records,
among them `cluster_3` and `cluster_5` (CHROMOPLEXY) and `cluster_6` (DEL, 10
records). Reads are PacBio Revio 116x tumor / 35x normal at
`ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/`,
range requests against the 118 GB BAM
([reference/DEMO_DATASETS.md](../reference/DEMO_DATASETS.md)). Severus, minda,
DRAGEN and NYGC callsets over the same reads give the cards where callers
disagree. HiFi reads make HG008-T the sawfish driver for the allele row.

**COLO829 (ONT), because everything is hosted.** 135 records, no `EVENT`, the
matched normal beside it. The unlabelled case.

**1000 Genomes, the cohort card.** A multi-sample callset has no tumor and
normal; its card is the genotype matrix over the site above the reads of one
carrier and one non-carrier, the samples read off the record's `GT` column.
`sv_multisamples` does that by hand for _RHD_. The queue is every common SV over
a gene.

**The matched normal is the built-in negative.** A card whose normal panel also
carries curves is the card the reviewer has to look at.

## Which callers group junctions

| Caller | Translocation record | Groups junctions? |
| --- | --- | --- |
| Sniffles2 | one record, bracket ALT + `CHR2` | no |
| cuteSV | one record, bracket ALT | no |
| nanomonsv, SAVANA | BND pairs, `MATEID` | no |
| DELLY | one `<BND>` record, `CHR2`/`POS2` | no |
| SvABA | BND pairs, `MATEID` | `EVENT` = the two mates only |
| Manta, DRAGEN SV | BND pairs, `MATEID` | `EVENT`, at most 2 junctions |
| GRIDSS / GRIPSS | BND pairs, `MATEID` | pairwise `BEID`, `LOCAL_LINKED_BY` |
| Severus | BND pairs, `MATE_ID` | `CLUSTERID`, a breakpoint-graph component |
| Dysgu | one record, `CHR2`/`CHR2_POS` | `GRP`, a graph component |
| LINX (on PURPLE's VCF) | inherits | `clusters.tsv`, `links.tsv` chains |
| VCF 4.4 / HG008 V0.5 | BND pairs | `EVENT`, `EVENTTYPE` |

sawfish also writes `EVENT`, on the records of one multi-breakpoint call such as
an inversion.

JBrowse reads the standard `EVENT` and nothing else. The SV inspector guide
carries the `sed` that renames Severus's `CLUSTERID`, and the same rename feeds
the portal.

## Sorting the queue is what makes it finishable

A hundred cards in file order is a hundred cards. `sv_callset_review.md`
§"Reading the sheet" lists what a reviewer looks for, and each item is a count
over reads the render fetches anyway:

| the page's reading | the number behind it |
| --- | --- |
| a fan of curves at both breakends | spanning reads with an `SA` at both loci |
| nothing connecting the panels | that count at zero |
| curves in the normal too | the same count in the matched normal |
| a dense fan in a region of ragged coverage | mappability of the two flanks |

The review then runs unsupported calls first, the ones the normal also carries
second, everything else after. Mappability is the one new input:
`mappability_qc.md` §"the number behind it" gives the command over the UCSC Umap
k100 bigWig, including the trap that a zero-mappability span emits no interval,
so an unweighted mean reads high on the regions it should condemn. An assembly
with no Umap track falls back to the fraction of reads at the breakend with
MAPQ 0.

## Pieces

`jb2export batch --manifest` already writes what the page reads: a row per image
with `file, locs, name, line, event, status`. `line` is the record's line in the
VCF, so the page reads `SVTYPE`, `SVLEN`, `FILTER` and the rest from the callset
itself and `jb2export` holds no list of blessed INFO keys.

1. **The page.** gene-review-portal's `app.jsx` with its card generalised to
   `{id, title, images[], links, meta}`, fed from a tumor manifest and a normal
   one joined on `line`.
2. **Read vs ref as a launch input**, above. `jb2export synteny` renders it.
3. **Tutorial**: a "review queue" section on `sv_callset_review`, the shortest
   on the page, and the HG008 portal deployed with `scripts/deploy-demo.sh`.

1 is two days and needs nothing else. 2 is the one with a design in it.

## Risks

- **Byte gate.** Every evidence panel needs `force:true` at 116x-200x, one panel
  per locus at a fixed flank, never one window per event.
  [per-region-banner-for-a-mixed-region-set](per-region-banner-for-a-mixed-region-set.md)
  is the open bug a mixed-size region set hits.
- **Capture readiness.** Software-rasterised Chromium over several panels of
  deep long reads is slow, which is why `jb2export` is the renderer and
  `@jbrowse/capture` the opt-in.
- **A contig is only as good as its alignment.** A contig through segmental
  duplication draws like a unique one unless the allele row colors by MAPQ.

## Decisions for Colin

- Where the page generator lives: a second bin in `gene-review-portal`
  (proposed), or a repo of its own sharing that `lib/`.
- HG008 first (has `EVENT`, needs NCBI range requests) or COLO829 first (all
  hosted, no events). Proposed: HG008.
