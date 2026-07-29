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
  missing Target, Reference, Mean query identity). New figure/spec
  `sv_synteny/linear_synteny_ortholog_colors` for the ortholog-coloring section.
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

**Copy number is not reproducible from published data.** The paper's Fig 10a is
QuicK-mer2 copy number across breeds, and those per-sample estimates are not
released: `kiddlabshare/public-data/QuicK-mer/QuicK-mer2-refs/` is empty, the
Dog10K share has no CNV directory, and the paper's Zenodo record (8084059) holds
variants, SVs, and the phased panel but no CN.

Recomputing it hits two walls, neither of which is the tool:

- **The published fastCN reference is canFam3.1 only** (`fastCN-refs/` has
  `canFam3.1.tar` 475 MB and `canFam3.1-Y-files.tgz` 1.8 GB). Everything we ship
  is canFam4, so CN computed against it would land on the wrong assembly, and
  these are mappability-defined windows, which liftOver handles badly. A canFam4
  reference would have to be built.
- **The reads are mostly not on the share.** `cram-share/` holds 15 CRAMs at
  ~10.6 GB each, and they are nearly all one breed; the rest of the collection
  is in ENA under PRJEB62420. "CN across breeds" therefore means tens of TB of
  downloads or compute at the archive.

The 15 shared CRAMs *are* range-requestable with their `.crai`, so a
single-locus read-depth comparison across those samples is cheap. It is not a
cohort CN matrix, and the breed spread does not support one.

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
