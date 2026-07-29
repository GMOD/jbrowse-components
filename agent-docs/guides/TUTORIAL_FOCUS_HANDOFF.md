# Tutorial focus pass: state and next steps

The rule this pass applies, from the user: **a tutorial follows one dataset step
by step.** A page that tours a capability across three datasets is a user guide
wearing a tutorial's clothes, and should either be refocused onto a single
dataset or moved under `user_guides/`. Prefer refocusing unless the datasets are
genuinely interrelated.

Two supporting habits came out of the pass and are worth keeping:

- **Every dataset should carry a built-in control** — something in the same
  figure, from the same pipeline, that ought to come out negative. The German
  Shepherd row in the wolfdog painting and the wolf rows in the SV panel are
  what make those figures self-validating.
- **End on checking the inference against the raw data.** Both Dog10K tutorials
  close by putting the underlying genotypes under the derived track. It is the
  step that separates a figure you can trust from a figure that merely looks
  good.

## Done

- `tutorials/synteny_visualization.md` — refocused onto the three _H. pylori_
  strains end to end. The hg38-vs-T2T figure went back to
  `tutorials/genomes_synteny.md`, which owns that dataset. The generic ribbon
  color-mode list moved to `user_guides/linear_synteny_view.md` (it was stale:
  missing Target, Reference, Mean query identity). The ortholog-coloring section
  is prose only: its figure was cut in review, because the locus-tag-only genes
  (no `gene` attribute, so all one fallback color) are most of the lane and
  randomColor gave them a magenta that swamped the handful of named orthologs
  the figure was meant to show.
- `tutorials/analyze_trio.md` — pared to the KHV trio and hap-ibd only.
- `tutorials/local_ancestry.md` (new) — Dog10K wolfdogs, replacing the 1000
  Genomes ASW trio the local-ancestry material used to use. Built by
  `scripts/build_dog10k_wolfdog_ancestry.sh`.
- `tutorials/dog10k_svs.md` (new) — the Collie eye anomaly deletion from Schall
  & Kidd 2025, plus the two _DENR_ SINEC2A1 dimorphisms as the contrasting kind
  of variant (220 bp at ~90% frequency, the reference carrying the rare allele).
  Both built by `scripts/build_dog10k_nhej1_sv.sh`.
- `tutorials/dog10k_lof.md` (new) — the _CYP1A2_ p.Arg373Ter nonsense allele
  from the Dog10K paper's Fig 10, built by `scripts/build_dog10k_cyp1a2.sh`.
  The coordinate is derived by translating the reference CDS rather than copied,
  which is worth repeating elsewhere: it re-checks against the assembly in use.
  Fig 10a now sits under it too: `scripts/build_dog10k_cyp1a2_cn.sh` writes a
  read-depth copy-number bigWig per published CRAM and the figure
  (`dog10k-cyp1a2-copy-number`) stacks nine of them as a
  `MultiQuantitativeTrack` on a fixed 0-6 axis. The Greenland Dog is flat at two
  across the window while every other dog steps up over the gene, and every row
  returns to two in the flanks, which is the control on the normalization. The
  track config carries all nine rows; the script covers all 15 CRAMs and prints
  each dog's CN over the element beside its CN in the flanks.
- `tutorials/methylation.md` (17b87d98d0) — refocused onto HG002 at the SNRPN
  imprinting center. The COLO829 by-type/2-color figure was already in
  `user_guides/alignments_track.md#modifications-and-methylation`, so the
  tutorial links there; the 6mA fiber-seq section moved into that same
  user-guide section, and its gallery card's `guide:` followed. Track configs
  now carry the real hosted URLs instead of `yourhost` placeholders, plus a
  provenance section naming the ONT open-data paths both files were sliced
  from.
- `tutorials/scatac_pseudobulk.md` (6f6bb56c35) — refocused onto the 5k PBMC
  dataset its own `build_scatac_pseudobulk.sh` produces, since that is the one a
  reader can actually run the pseudobulk step on. SnapATAC2 stays inline; ArchR,
  sinto + deepTools, and the bare-fragments route condense to a bullet each. The
  CATlas ALB figure moved to `user_guides/multiquantitative_track.md`; CATlas
  keeps its gallery card and a Sources pointer to its public BigWigs. The
  tutorial card's crop source in `gen-tutorial-thumbs.ts` had to move with the
  figure — a card whose `src` is no longer on the page still builds, so nothing
  fails to warn you.

## Next, in the order I would take them

### `tutorials/rnaseq.md` — needs a finding, not a tour

The user's steer: end on something biologically interesting rather than "here is
some stuff" — a new gene model, intron readthrough, or **differential isoform
usage with transcript glyphs colored by a pipeline's call**. That last one is
the strongest and is mechanically ready: a GFF attribute plus
`jexl:randomColor(get(feature,'<attr>'))` on the canvas display colors
transcripts, exactly as the H. pylori ortholog figure does. What it needs is a
two-condition long-read dataset and a small pipeline to write the attribute.
Note the coloring jexl evaluates on the **drawn** feature (a CDS subfeature for
a gene), which is why `name` gave protein accessions and `gene` was the right
attribute — see the same trap in `specs/synteny.ts`.

### `tutorials/pangenome_hprc.md` — optional

Carries both HPRC release 1 and release 2 figures. The user is fine either way,
since the two releases are the same project. Lowest priority.

## More Dog10K loci, if wanted

The infrastructure is in place (`test_data/dog10k/config.json`, remote slicing,
breed-labeled `layout`), so each of these is roughly an hour:

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
  cost, so nobody starts it blind: about 6 minutes per chromosome (roughly one
  minute of remote slicing, the rest FLARE), so ~3.5 hours for the sweep. The
  local-ancestry tutorial's numbers are chr1 only and say so; the sweep is what
  would let it quote genome-wide fractions.

_DENR_ and _CYP1A2_ are done (see above).

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
- **AMY2B duplication**, chr6:47,375,677-47,390,529. 1581/1588 breed dogs
  homozygous carrier; 50/55 wolves homozygous reference. Pairs with the CN
  profile above: the same event as presence/absence and as copy number.
- **RNASE1 exonic SINE insertion**, chr15:18,164,072 (Paragraph set). 26 of 55
  wolves heterozygous, one dog in 1,588 — the mirror image, and both are diet
  genes.
- **SLC28A3 duplication**, chr1:75,578,115 (136 kb). GBGV000003 homozygous, four
  more GBGVs and a PBGV heterozygous: Fig 11 as genotypes when the CN route is
  out of reach.

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

## Which dog assembly

Everything here is **canFam4 = UU_Cfam_GSD_1.0** (the German Shepherd assembly):
`test_data/dog10k/config.json`, its `chrom.sizes`, the pre-existing
`test_data/cfam2` demo, all three Dog10K callsets, and the hosted UCSC gene
track the figures point at. Verified by chr1 = 123,556,469 bp against UCSC's
`canFam4.chrom.sizes`.

The wider dog literature is still largely canFam3.1 — the published genetic
maps, most GWAS, and dbSNP rsIDs — which is exactly why the local-ancestry
tutorial has to generate its own uniform map and why the CYP1A2 tutorial derives
the stop codon's coordinate instead of copying an rsID's position. Treat any
dog coordinate from a paper as canFam3.1 until proven otherwise.

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
