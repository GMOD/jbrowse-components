---
name: protein-figures
description: "The protein-browser hero figures, a genome view linked to Mol* structures: the spec behind each, why its panels and cameras are set as they are, its known weaknesses, and the traps that produce a plausible wrong one. Read before reshooting or adding one."
audience: internal
kind: spec
---

# Protein figures

Each figure tells one story: a variant whose structural consequence the reader
can see, the JBrowse app UI in frame, short callouts. Colin picked them for an
NIH R01. Unbuilt candidates are in
[ideas/collections/protein-figures-unbuilt.md](../ideas/collections/protein-figures-unbuilt.md).

## What a figure must show

- **What the variant does**, not an agreement between two per-residue maps.
  The scan-vs-AlphaMissense pair "just says 'crispr matches prediction'"
  (Colin, 2026-10-21), so it is gallery, not hero.
- **A painted fold reads as damage spreading from the variant.** Each
  residue's color is the effect of changing that residue, on the wild-type
  fold; the mutant never appears. A painted fold needs a key saying "effect of
  changing each residue", not just a pill naming its source.
- **The linear view stays critical**: genome evidence drives the structure.
- WILD TYPE / MUTANT pills are "turbo clear"; keep the app chrome.
- One hue shared by the codon column, its chip and the residue carries the
  link (the cold review below).

## The figures

Sessions sit beside each spec in `website/scripts/specs/`, so a figure
recaptures without its builder. Builders re-derive cameras and superpositions
and are machine-local under `~/src/protein-figure-builders/` (`hero-figures/`,
`hero2/`, `ccr5/`, `metex14/`).

- **TP53 Y220C, a hero** (`protein_figure_tp53_y220c.ts`): the scan over
  codons 198–224 above three opaque-surface panels at residue 220: 2XWR
  (Tyr220 fills the spot), 2J1X (an empty pocket), 9S9O (rezatapopt in it).
  One camera through a CA superposition onto 2XWR (0.5 Å over 189 residues),
  aimed down the pocket's least-occluded direction. One callout points at the
  empty pocket.
- **HBB E6V, the other hero** (`protein_figure_hbb_e6v.ts`,
  `hero2/build_hbb_e6v.py`): 2HHB with Glu6 alone; 2HBS with Val6 of one
  tetramer in the Phe85/Leu88 pocket of the next, cartoon with sphere marks.
  One camera through a CA superposition of 2HHB chain B onto 2HBS chain H,
  48 Å out: at 58 Å Protein3d wrote the Glu6 label of the other β chain in the
  corner, so only the legend names Glu6.
- **HBB E6V with an MSA** (`protein_figure_hbb_e6v_msa.ts`, in no doc; the PI
  picks between it and the plain one): twelve UniProt beta globins, residues
  1–30, each column under its codon, so the E6V highlight runs as one band
  from codon to column. The window is exon 1's 30 codons plus 20 bp of UTR;
  codon 31 crosses the intron, so a wider window breaks the fit.
  - Position 6 is not acidic in every mammal (murine rodents, elephants, hyrax
    and tenrec Ala; ground squirrels Gly); the Mouse row says so. No reviewed
    mammalian beta globin carries Val.
  - Helix A (Thr4–Val18, the PDB HELIX records) is orange in all three views:
    a domains2genome track (`specs/hbb_helix_a/`), the strip's `features`
    fill (`#ffbe7d`, light so the magenta band stays magenta), and the
    structures' `color.values`. Chain B draws as 146 per-residue cartoon marks
    so its own helix A is a darker `#a84a00`, since one orange read as one
    helix where it lies against the Val6 chain's.
  - The tree is NCBI Taxonomy lineages, topology only, polytomies kept;
    `treeWidth` is set because the fitted label column ellipsized names.
  - No residue row under the codons: the gene track already prints M1..G30.
  - Each molecule's second beta chain (2HHB D, 2HBS F) leaves `chains` and
    draws as a grey cartoon mark, so the highlight lands on the marked chain
    only. A cartoon mark draws the polymer alone, so that chain's heme is
    undrawn.
  - Close-ups roll a quarter turn so the Val6 tetramer sits below, as in the
    zoom-out (`hero2/hbb_e6v_roll.py`, `hbb_e6v_overview.py`).
- **HBB E6V, plug and pocket** (`protein_figure_hbb_e6v_pocket.ts`, in no
  doc; a grant figure, 1523 px for 7 in print): magenta codon 6 → column 6 →
  Val6, teal codons 85/88 → columns → Phe85/Leu88 on the neighbour.
  - Two abutting genome regions (codons 1–13, 80–92). The alignment matches
    them by hiding columns: a full-length `HBB` query row outside the tree,
    drawn rows gapped outside the windows, `allowedGappyness: 99`.
  - HbS is a `columnTracks` text row, dots except a magenta V.
  - `highlightLabelsVisible` off: react-msaview writes a label over the top
    row's cell, which hid Human's Glu6. Callouts name the codons instead.
  - 2HBS `chains: ['H']` with `filter` residue ≤ 84, the rest as cartoon
    marks, so the teal highlights skip H's own Phe85/Leu88.
  - A codon callout's leader head stops 14 px short of centre
    (`LEADER_HEAD_GAP`, `products/jbrowse-capture/src/annotationOverlay.ts`),
    landing 6–10 px off centre, inside the codon. The "codons 14–79 / not
    shown" pill has no leader: between the E band and the seam a leader gets
    no shaft past its 32 px head.
  - The tutorial's `gwasCatalog_sickle_cell_traits` narrowed to two rs334
    records, labels off (they print at about 4 pt) and one magenta pill naming
    both with their p-values.
- **Variant pairs** `protein_figure_brca1_m1775r.ts` and
  `protein_figure_snca_e46k.ts`: the SNCA builder looks down each fibril's
  rung axis and turns the E46K layer to put Lys80 on the wild type's pixel.
- **CCR5 Δ32** (`protein_figure_ccr5_delta32.ts`, `_gene.ts`, `_combo.ts`,
  builder `ccr5/`): three 1000 Genomes 30x CRAMs from the public S3 bucket
  (HG00137 Δ32/Δ32, HG00101 Δ32/+, HG00096 +/+, genotypes from EBI's 2022
  phased panel; the S3 copies of the 2020 VCFs are empty) over 6MEO colored by
  the residues Δ32 loses (185 on; it keeps 1–184, adds 31 frameshifted, stops
  at 215). A track of the shifted frame's codons (`ccr5/frameshift.py`)
  carries the step from missing bases to missing receptor. Panel C draws
  residues 1–184 alone through Protein3d 1.26.0's structure `filter`, without
  gp120: Δ32 protein misfolds and never reaches the surface. Cut: maraviroc
  (an analogy beside a consequence), allele frequency (its interesting form is
  by population), ClinVar (draws the deletion as a green "benign" bar). The
  `_gene` figure is a synteny view over `demos/ccr5/`, the Δ32 allele its own
  assembly; `ideas/waiting-on-a-call/a-variant-haplotype-is-a-lane.md`
  generalises it.
- **MET exon 14 skipping** (`protein_figure_met_ex14.ts`, tutorial
  `protein_variants_met_exon14`, reached by clicks from the Protein Browser's
  `gene=MET&structure=3bux` link): NCI-H596 RNA joins exon 13 to 15, its DNA
  has no reference reads at c.3028+1 (chr7:116,771,990 G>T), EBC-1 keeps the
  exon, and 3BUX's assembly 5 shows CBL on MET 997–1009. `scripts/build_metex14.sh`
  slices CCLE's GRCh37 reads from SRA and realigns to hg38 chr7 with HISAT2
  (minimap2 2.27's `splice:sr` lost most spliced reads). A review cut an
  "empty pocket" panel (a chain filter no reader can set, and CBL still binds
  other substrates).
- **KRAS G12C** (`protein_figure_kras_g12c.ts`) and the scan-vs-AlphaMissense
  pair (`protein_figure_scan_vs_alphamissense.ts`: BRCA1 1T15 M1775R and the
  TP53 3KMD dimer on DNA R248Q, folds painted by `color.field: 'track'` and by
  `alphaMissense`) stay in the gallery. The older specs are in
  `protein_variants.ts`.

Hosted data: `jbrowse.org/demos/metex14/`, `jbrowse.org/demos/brca1/` (every
missense SNV, residue mean bigWig) and `tp53_sge/` (position mean bigWig).

## Protein3d surface the figures lean on

- 1.25.0: a mark is a layer in the mark display's spelling,
  `{ site, mark: 'spheres' | 'sticks' | 'cartoon', encoding: { color: { value } } }`;
  a site can name a whole chain (`G:*`). The view-level `color` is still flat
  (the plugin's idea `view-color-in-the-encoding-spelling`).
- 1.24.0: `protein-view-ready` waits for a color field's values and the paint
  after it; `occlusion: true` beside `silhouettes`. Plugin doc:
  `docs/figure-sessions.md`.
- 1.26.0: structure `filter` in ADR-238's predicate vocabulary;
  `residueFilter.ts` ANDs its predicates.
- No range site (`B:4-18`): a sub-chain color goes through `color.values`,
  which paints every drawn copy of the mapped entity.
- The 21 `*.session.json` snapshots predate the `LaunchView-ProteinView` and
  `LaunchView-MsaView` session-spec entries; convert one when its figure is
  next touched.

## Reviews

In `~/src/protein-figure-builders/hero-figures/review/`: a cold reviewer of
eight figures, a blinded ideator given a capability sheet, a landscape survey.

- The landscape survey is why each figure leads with nucleotide-level genome
  tracks linked to a structure: that link is what these figures exist to show.
- The cold reviewer ranked snca_e46k 7.5, brca1_m1775r 6.5, tp53_y220c 6,
  every older figure 4 or below. The MSA panel hurt every figure that had it;
  sentence callouts dilute. Its two upgrades (SNCA fibrils superposed on
  Lys80, Y220C in three linked panels) are built.
- Dropped: the TP53 zinc prototype (the scan is red across the stretch, so its
  four codons do not stand out) and R273H (no R273H crystal with DNA exists
  except with a suppressor).

## Known weaknesses

- Y220C: half of rezatapopt sits under the surface from every direction, so
  panel D shows its two ends (the right-edge lump is the same molecule); the
  camera's `radius` clips only the far side. 2J1X and 9S9O carry M133L,
  V203A, N239Y and N268D, away from the pocket.
- KRAS shows what the drug needs, not G12C's own effect (KRAS locked on).
- HBB E6V: the gene track names the codon E7 (HGVS counts Met1) where pills
  say Glu6/Val6; the codon track gives both. Panel B has no residue label. No
  shared E6V pill: the genome chip, react-msaview's column label and
  Protein3d's label each style the highlight differently, and one pill needs a
  code change in the chip and in react-msaview's `renderHighlights`.
- Plug and pocket: the alignment draws no break at the genome view's seam
  (react-msaview has no mark for hidden columns), and Protein3d's color key
  prints at about 4 pt with no session setting to hide it
  (`ProteinViewHeader.tsx`).
- M1775R's BACH1 peptide in the mutant panel is superposed from 1T15 (1N5O has
  none); the reviewer wants "modeled" in large type.
- E46K fibrils are recombinant in-vitro folds, and 6CU7 and 6UFR are different
  polymorphs, so "the fold rearranges" overclaims. No segment superposes well
  (16-residue windows above 4.5 Å); the panels share only Lys80's spot and the
  C-terminal strand's direction. A wild-type Glu46–Lys80 distance line was
  tried and dropped: a 3 Å line's label lands on the residue labels.
- TP53's painting has less contrast than BRCA1's: the Funk scan's per-codon
  mean sits near zero over much of the domain, so a 2-class threshold at 0
  paints a mottled dimer.
- Older figures: BRAF, CFTR, APOE and F5 show an orange "Not in the link" in
  the alignment toolbar; the Factor V Manhattan reads as a haplotype block.

## Traps

- A display setting in a session spec, or a dragged track height, lands on
  the track's shared display config, so a track open in two views draws one
  height and one sort in both. `met_ex14` gives its DNA track one height.
- Adding a view shifts `anchor.view` indexes; a residue callout then anchors
  to the wrong panel without an error.
- The generator has no in-page wait, so a late color depends on the plugin's
  ready marker covering it; a fixed `delay` shot green folds in a different
  panel each run.
- A spec file that fails to parse breaks every capture, since the generator
  loads them all.
- A component-id mark (`A1JMR`) draws the ligand of every chain, undrawn ones
  included; name one copy by residue (`A:402`).
- A PDB entry's first assembly can be one chain (3BUX's are the peptide alone
  and CBL alone until assembly 5). Query every assembly
  (`data.rcsb.org/rest/v1/core/assembly/<id>/<n>`) before saying a partner
  needs "Deposited model".
- A fibril's principal axis of chain centroids can run across the two
  protofilaments; the rung axis is the vector between the closest pair of
  chains.
- An alignments track short enough to pack the deletion-carrying reads out of
  sight reads as reference; CCR5's read tracks are 160 px and sorted on a base
  inside the deletion.
- A camera aimed at the face a color occupies overstates how much of the
  protein it is; CCR5's panel B turns until kept and lost halves sit side by
  side, as the residue counts say (182 kept, 129 lost in 6MEO chain B).
- `~/src/protein-figure-builders/metex14/walk.mjs` walks the MET tutorial's
  clicks against the hosted app; rerun it after changing a step. A copied view
  opens below the original, off screen and drawn only once scrolled to.
- Capture with `TMPDIR=/var/tmp/<dir>`: `/tmp` is a 16 GB tmpfs. Screen outputs
  under `/var/tmp/` (`hero2/`, `hero-figures/`, `proto-shots/`, `sge-screen/`,
  `r01-*/`) are deleted after 30 days untouched.
- A palette previews on all three views before a release: msaview's domain
  colors feed the genome domain track and protein3d through one color object,
  so an `encodings: [{ channel: 'featureFill', field: 'name', domain, range }]`
  on the MsaView snapshot in a temporary spec copy recolors all three against
  the hosted plugins.
- Give a session `highlights[].color` an opaque hex (`#e0218a`): an alpha below
  1 renders protein3d's spheres dark maroon or black. The opaque genome band
  then covers the codon, so keep a GWAS label clear of it.
- A protein3d capture with a hover can keep Mol*'s default element colors
  (lime carbons) around the hovered residue; re-shoot before reading it as a
  palette effect.
