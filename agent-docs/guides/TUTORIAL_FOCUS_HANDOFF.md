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
  & Kidd 2025, built by `scripts/build_dog10k_nhej1_sv.sh`.
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
- **_DENR_, Mastiff clade** — two intronic deletions, each a SINEC2A1 with an
  intact poly(A) tail and target-site duplications, present in the German
  Shepherd reference (Fig S6).
- **Wolf-ancestry frequency across all autosomes** — run
  `build_dog10k_wolfdog_ancestry.sh` over chr1..chr38 and summarize wolf
  ancestry per position across the eight wolfdogs as a quantitative track.
  Compelling if a depleted region lands on something known, but with eight
  animals the noise is real: describe it, do not call it selection.

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
