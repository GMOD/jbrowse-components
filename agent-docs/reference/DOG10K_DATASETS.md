---
name: dog10k-datasets
description: The Dog10K callsets, loci and measured recipes behind the local-ancestry, SV and LoF tutorials — which assembly everything is on, which VCF actually carries DUP/INV, how to compute per-sample copy number from the hosted CRAMs, and the gotchas that produce a plausible wrong answer. Read before adding a Dog10K locus or figure.
audience: internal
---

# Dog10K: callsets, loci and measured recipes

What the `local_ancestry`, `dog10k_svs` and `dog10k_lof` tutorials rest on. The
infrastructure is in place (`test_data/dog10k/config.json`, remote slicing,
breed-labeled `layout`), so a new locus is roughly an hour. Forward-looking
tutorial ideas live in
[ideas/tutorial-ideas-audit.md](../ideas/tutorial-ideas-audit.md);
the editorial rules these pages follow are in `website/CLAUDE.md`.

## Which dog assembly

Everything here is **canFam4 = UU_Cfam_GSD_1.0** (the German Shepherd assembly):
`test_data/dog10k/config.json`, its `chrom.sizes`, the pre-existing
`test_data/cfam2` demo, all three Dog10K callsets, and the hosted UCSC gene track
the figures point at. Verified by chr1 = 123,556,469 bp against UCSC's
`canFam4.chrom.sizes`.

The wider dog literature is still largely canFam3.1 — the published genetic maps,
most GWAS, and dbSNP rsIDs — which is exactly why the local-ancestry tutorial has
to generate its own uniform map and why the CYP1A2 tutorial derives the stop
codon's coordinate instead of copying an rsID's position. **Treat any dog
coordinate from a paper as canFam3.1 until proven otherwise.**

## What already ships

- `tutorials/local_ancestry.md` — Dog10K wolfdogs, replacing the 1000
  Genomes ASW trio the local-ancestry material used to use. Built by
  `scripts/build_dog10k_wolfdog_ancestry.sh`.
- `tutorials/dog10k_svs.md` — the Collie eye anomaly deletion from Schall
  & Kidd 2025, built by `scripts/build_dog10k_nhej1_sv.sh`. That script still
  writes the _DENR_ slice too, and the config still declares the tracks, but
  **there is no DENR figure and it should not be rebuilt** — see below.
- `tutorials/dog10k_lof.md` — the _CYP1A2_ p.Arg373Ter nonsense allele
  from the Dog10K paper's Fig 10, built by `scripts/build_dog10k_cyp1a2.sh`.
  The coordinate is derived by translating the reference CDS rather than copied,
  which is worth repeating elsewhere: it re-checks against the assembly in use.
  Fig 10a sits under it as `dog10k-cyp1a2-cohort-copy-number`, from
  `scripts/build_dog10k_cyp1a2_cn.sh`: named animals over the whole collection,
  both lanes from the callset's own per-sample `DP`.
  **There is no `dog10k-cyp1a2-copy-number` figure** and this file used to say
  there was. That was the 15-CRAM `MultiQuantitativeTrack` stack of read depth;
  the track (`dog10k_cyp1a2_cn`) is still in the config and the script still
  writes it, but it is deliberately not on the page, because which 15 dogs have
  CRAMs is an accident of what the share published. It survives as the
  validation of the callset-depth route (r = 0.92 over shared windows), not as a
  picture. `specs/dog10k.ts` carries the same note where the figure would be.
- `tutorials/dog10k_svs.md` also carries **AMY2B and RNASE1**, the two diet
  genes, stacked as one composed figure (`dog10k-diet-genes`) over one panel
  sliced from both callsets in the same order so the lanes read row for row.
  Built by `scripts/build_dog10k_amy2b_sv.sh`. Measured 2026-08-07: the amylase
  `DUP` (chr6:47,375,677, Manta aggregate) is 1568/1575 breed dogs hom alt
  against 50/55 wolves hom ref, and the RNASE1 SINE insertion
  (chr15:18,164,072, Paragraph) is 26/55 wolves het against 2 carriers in 1,824
  dogs. **The Arctic-breed reading is a trap worth not re-deriving**: two of
  three Greenland Dogs lack the duplication, which looks like the published
  low-copy-number result for sled breeds, but the third carries it and so does
  every Alaskan Malamute and Samoyed. The genotype is presence/absence, not
  copies, so it cannot speak to that result either way.
Both Dog10K tutorials close by putting the underlying genotypes under the derived
track, and both carry a **built-in control** — the German Shepherd row in the
wolfdog painting, the wolf rows in the SV panel. The 2026-08-04 rebuild of the
painting added the other half: a POSITIVE control (eight gray wolves held out of
the wolf panel and painted like any target) plus a 219-breed sweep that is
neither, so the subject has a scale on both sides rather than only a floor. Two
of the eight positives came out wrong, which is the argument for having them.

## More loci, each about an hour

- **_HMGA2_, Spitz group** — three intronic SVs in a gene tied to body weight
  and ear type (Schall & Kidd Fig S5).
- **_AP3B1_, Collie & Shetland Sheepdog** — the gene behind gray Collie
  syndrome, which joins the list once the paper's significance threshold is
  relaxed.
- **Wolf-ancestry frequency across all autosomes** — run
  `build_dog10k_wolfdog_ancestry.sh` over chr1..chr38 and summarize wolf
  ancestry per position across the eight wolfdogs as a quantitative track.
  Compelling if a depleted region lands on something known, but with eight
  animals the noise is real: describe it, do not call it selection. Measured
  cost, so nobody starts it blind, and RE-MEASURED 2026-08-04 after the target
  set grew from 11 animals to 243: chr1 now takes about 15 minutes (4 of remote
  slicing for 591 samples, the rest FLARE at 16 threads). chr1 is ~6% of the
  autosomes, so the sweep is on the order of 4-5 hours rather than the ~3.5 the
  11-animal run implied. The local-ancestry tutorial's numbers are chr1 only and
  say so; the sweep is what would let it quote genome-wide fractions.

_CYP1A2_ is done (see above).

**_DENR_ was cut, 2026-08-11, and the reason generalizes.** The two SINEC2A1
dimorphisms in adjacent introns are a real result — 220 bp at ~90% frequency
with the reference carrying the rare allele, and the two repeats have different
ages (every wolf has lost the left one, a third still carry the right one). It
never became a figure. Drawn at their true spans the records are two ~35 px
stripes in an otherwise blank frame ("it just doesn't seem to be telling a
strong story by itself. visually it is like 'ok two verticalstripes'"); moved to
the matrix display, which widens them to half a panel each, they read as
multi-kb deletions over the whole gene and needed a caption saying they are not
("this is a somewhat chaotic screenshot, unsure what i should be getting from
this. are there 'giant' SV overshadowing the ones that are intending to be
shown?"). Two displays, two rejections, and re-zooming lands back on the width
that produced the first one.

The diagnosis is not the display. **Two ~220 bp records genotyped across 56
animals is a table, not a picture** — the finding is a frequency-and-ancestry
claim, and the only positional content ("adjacent introns") is one sentence the
gene model already carries. The polarity point it also carried (the reference
genome holds both repeats, so "how many SVs does this dog have" depends on what
you called against) is worth keeping in prose somewhere; it does not need this
locus.

**Verified 2026-07-29, genotypes checked remotely.** Use the
`SV-genotype-v2.merge.agg_only.08032022.vcf.gz` callset under
`kiddlabshare/dog10K/Manta-SV_2022-03-28/`: it is **1.08 GB** (not the 5.9 GB
Zenodo Paragraph set), covers the same 1,879 samples, and unlike the Paragraph
set it carries DUP and INV records. Each of these is the existing
`build_dog10k_nhej1_sv.sh` recipe pointed somewhere new:

- **Ridgeback 133 kb duplication**, chr18:48,828,545-48,962,003. Every Rhodesian
  and Thai Ridgeback carries it (8 homozygous, 1 het), plus exactly the three
  African village dogs the paper names (VILLCG000006, VILLKE000001,
  VILLLR000017) — and one Schipperke it does not.
- **SLC28A3 duplication**, chr1:75,578,115 (136 kb). GBGV000003 homozygous, four
  more GBGVs and a PBGV heterozygous: Fig 11 as genotypes when the CN route is
  out of reach.

_AMY2B_ and _RNASE1_ are done (see above). The counts this file carried for them
were close but not exact, so take the build script's output over any number
written down: it was 1581/1588 breed dogs here and the script prints 1568/1575,
the difference being which category the sample table files an animal under.

**A selection scan is one download.** Per-clade AF from that same 1.08 GB
callset (`bcftools +fill-tags -S`), Fst against the rest, written as a bgzipped
BED: `GWASAdapter` + `LinearManhattanDisplay` already ship and already handle
ranged SVs. The authors' own Ohana output is published as a 52 KB canFam4
bigBed (283 sites, `github.com/KiddLab/dog-long-read-sv`, alongside two more SV
bigBeds), which loads directly as a validation row under the computed scan. The
bigBeds are bed9 with no names or scores, so they are an overlay, not a
substitute.

**Per-sample copy number is computable at a locus, cheaply.** The published
QuicK-mer2 estimates behind Fig 10a and Fig 11 are *not* released
(`kiddlabshare/public-data/QuicK-mer/QuicK-mer2-refs/` is empty, no CNV
directory on the share, and Zenodo 8084059 holds variants/SVs/the phased panel
but no CN). Recomputing them cohort-wide is still out of reach: the published
fastCN reference is canFam3.1 only, and the reads for the full collection are
not on the share. But a *locus* profile needs neither.

Measured recipe, verified 2026-07-29:

- `cram-share/` holds 15 range-requestable CRAMs with `.crai`. CRAM decode needs
  no reference download — the `@SQ` lines carry M5, so
  `REF_PATH=https://www.ebi.ac.uk/ena/cram/md5/%s` fetches only the chromosome
  touched (`REF_CACHE` keeps it).
- Normalization is free: column 14 of the sample table is
  `effectiveAutosomalMeanCoverage`, so `CN = 2 * depth / cov`.
- `samtools depth -r <locus>` over each CRAM, binned, then that formula, takes
  minutes for a 100 kb window across several samples.

At AMY2B (chr6:47,375,000-47,390,000) this gives CN ~12 for the Greenland Dog
and the Bourbonnais Pointing Dogs, CN 2 for the English Springer Spaniels, flat
2 in the flanks, with sharp boundaries. At CYP1A2 (chr30) it gives 1.9 for the
Greenland Dog, ~4 for pointers and spaniels, ~5 for a Chihuahua and the
Azerbaijan village dog — Fig 10a in miniature, and it sits directly under the
`dog10k_lof.md` nonsense-variant panel.

What it is not: this is plain depth, without QuicK-mer2's GC correction or SUNK
mappability control (a mask could come from the share's `callable-genome-mask/`).
And the 15 samples are only Chihuahua x2, Bourbonnais Pointing Dog x8, English
Springer Spaniel x3, Greenland Dog, Azerbaijan village dog — no wolves, and no
Grand Basset Griffon Vendéen, so Fig 11's SLC28A3 expansion is not reachable
this way.

For that one, column 5 of the sample table carries SRA runs (GBGV000001-3 =
SRR12330329/330/331, plus Basset Hounds and PBGVs), so a targeted panel is
~15-20 GB of fastq per sample plus a one-time canFam4 QuicK-mer2 index build.

**phyloP on canFam4 exists but is awkward.** Zenodo 8084059 carries
`zoonomia-cf3.1-lifted-to-cf4.liftover.phylop.20210708.bw.gz`, which is Fig 10c.
It is a 12.8 GB *gzipped* bigWig, so it cannot be range-requested: adding a
conservation track under any of these figures means downloading it whole,
decompressing, and slicing the locus into a small bigWig. UCSC has no
conservation track for canFam4.

## Gotchas worth not rediscovering

- `layout` HP indices are **0-based** on the wire (`<sample> HP0`/`HP1`, see
  `makeHaplotypeSources`). Using 1/2 renders every second row empty.
- `jexlFiltersSetting` has **no effect** on `LinearMultiRowFeatureDisplay`. A
  figure that wants a subset of painted rows needs a different track, not a
  filter.
- `flare_anc_to_bed.py` keys its palette on the ancestry **name**, not FLARE's
  internal code — the code is not stable between runs and a rebuild silently
  swapped the wolf and dog colors once.
- A local-ancestry reference panel must include the targets' own background. An
  alphabetically truncated dog panel (first 60 breeds, no shepherd) put 0.4%
  spurious wolf ancestry on the German Shepherd control; the full 318-breed
  panel takes it to 0.0%.
- Zenodo serves a file and its index from separate `/content` URLs, so remote
  slicing needs `bcftools view … "$DATA##idx##$INDEX"` rather than letting
  bcftools guess the index URL.
