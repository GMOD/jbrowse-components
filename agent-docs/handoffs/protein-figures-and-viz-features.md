---
name: protein-figures-and-viz-features
description: "Hero figures for the protein browser (genome view linked to Mol* structures), each showing what a variant does. On main: the heroes TP53 Y220C and HBB E6V, then KRAS G12C, SNCA E46K, BRCA1 M1775R and the CCR5 Δ32 set. Open: more figures where genome evidence drives the structure, and the painted fold as a supporting layer."
---

# Protein figures and 3D visualization features: what is left

Revised 2026-10-28. Colin wants figures that win an NIH R01: one story
each, a variant whose structural consequence the reader can see, the JBrowse
app UI in frame, short callouts, and several candidates to pick from or present
together.

## Colin's read of the 2026-10-21 round

- **The scan-vs-AlphaMissense pair is not the hero.** His words: it "just says
  'crispr matches prediction'", and he doubts that is a good story. Both
  figures stay in the gallery as the capability no other tool has (a genome
  track painting a fold), but the grant figure has to show what a variant
  *does*, which an agreement between two per-residue maps does not.
- **The painted fold misreads on first contact.** He took the red for damage
  spreading from M1775R. Each residue's color is the effect of changing that
  residue, on the wild-type fold; the mutant never appears. The pills name the
  source that painted each fold, not what the color means. Any reuse of the
  painted fold needs a key that says "effect of changing each residue".
- Carry forward from his earlier reactions: WILD TYPE / MUTANT pills are
  "turbo clear"; keep the app chrome; short callouts.

## On main

- **Scan vs AlphaMissense**, `protein_figure_scan_vs_alphamissense.ts`: BRCA1
  1T15 (chains A and B, M1775R) and the TP53 3KMD dimer on DNA (chains A, B,
  E, F, R248Q), the genome view at codon resolution with the scan's dots and
  the hub's AlphaMissense heatmap, the fold painted by `color.field: 'track'`
  and by `alphaMissense`, one camera. Sessions beside the spec; the builders,
  the in-page camera reader and the capture script with a paint gate are
  machine-local in `/var/tmp/hero-figures/`.
- **TP53 Y220C, a hero**, `protein_figure_tp53_y220c.ts`: the
  scan over codons 198–224 above three opaque-surface panels at residue 220,
  2XWR (Tyr220 fills the spot), 2J1X (an empty pocket) and 9S9O (rezatapopt in
  it). The builder carries one camera through a CA superposition onto 2XWR
  (0.5 Å over 189 residues) and aims it down the pocket's least-occluded
  direction. Pills name the
  state; one callout points at the empty pocket.
- **HBB E6V, the other hero**, `protein_figure_hbb_e6v.ts` with
  `hbb_e6v.session.json`, built by `/var/tmp/hero2/bin/build_hbb_e6v.py`
  (the `hb_j` prototype in main's spelling): 2HHB with Glu6 and nothing
  beside it; 2HBS with Val6 of one tetramer in the Phe85/Leu88 pocket of the
  next, cartoon with sphere marks. The builder carries one camera through a
  CA superposition of 2HHB chain B onto 2HBS chain H, 48 Å out. At 58 Å
  Protein3d wrote the Glu6 label on the other β chain in the corner, under
  either chain fit; at 48 Å that copy leaves the frame and 2HHB draws no
  residue label, so only the legend names Glu6. It replaced the GWAS-and-hydrophobicity
  pair of the same name.
- **HBB E6V with an MSA**, `protein_figure_hbb_e6v_msa.ts`, published and in no
  doc yet (the PI picks between the two): the same structures under a strip of
  twelve UniProt beta globins, residues 1-13, each column sized to sit under
  its codon, so the session's E6V highlight runs as one band from the codon
  through the column. Position 6 is not acidic in every mammal: murine
  rodents, elephants, hyrax and tenrec carry Ala, ground squirrels Gly. The
  Mouse row says so; no reviewed mammalian beta globin carries Val.
  - Helix A (Thr4-Val18, the PDB HELIX records) is orange in all three views:
    a genome track from domains2genome (inputs and command in
    `specs/hbb_helix_a/`), the strip's `features` fill, and the structures'
    `color.values`. The Globin domain it replaced spans the whole chain, so on
    a structure it would point at nothing.
  - Structures run WILD TYPE | SICKLE, TWO MOLECULES | SICKLE CONTACT. 2HBS
    draws EFGH grey and the neighbouring ABCD as light-teal cartoon marks, and
    the pocket spheres are a darker teal, so the color names the molecule.
  - Each molecule's second beta chain (2HHB D, 2HBS F) leaves `chains` and
    draws as a grey cartoon mark, so the session highlight lands on the marked
    chain only: C and E get their Glu6/Val6 labels and D loses the stray Val6.
    A cartoon mark draws the polymer alone, so that chain's heme goes
    undrawn; D still hides its highlight label.
  - Both close-ups roll a quarter turn so the Val6 tetramer sits below, as in
    the zoom-out. Cameras: `/var/tmp/hero2/bin/hbb_e6v_roll.py` and
    `hbb_e6v_overview.py`.
  - Protein3d has no range site (`B:4-18`), so a sub-chain color goes through
    `color.values`, which paints every drawn copy of the mapped entity.
- **Variant pairs** `protein_figure_brca1_m1775r.ts` and
  `protein_figure_snca_e46k.ts`; the SNCA builder looks down each fibril's rung
  axis and turns the E46K layer to put Lys80 on the wild type's pixel.
- Builders for both (superposition, pocket aim, in-plane fit) are
  machine-local in `/var/tmp/hero2/bin/`, beside the prototype shots.
- The older specs in `protein_variants.ts`.
- Protein3d 1.25.0 (released and live in the store 2026-10-22): a mark is a
  layer in the mark display's spelling,
  `{ site, mark: 'spheres' | 'sticks' | 'cartoon', encoding: { color: { value } } }`,
  and a site can name a whole chain (`G:*`); CCR5 draws gp120 that way.
  Distances take the same `encoding`. A 1.23/1.24 session's `style` and string
  `color` migrate in `preProcessSnapshot` (`checkedLayers`). The view-level
  `color` is still flat; the plugin's idea `view-color-in-the-encoding-spelling`
  lays out moving it to ADR-238's channel.
- Protein3d 1.24.0: `protein-view-ready` waits for a color field's values and
  the paint that follows (1.23.0 flipped it 20–40 s early for `track`,
  `alphaMissense` and `clinvar`, and a capture showed Mol*'s chain colors under
  the right legend), and `occlusion: true` beside `silhouettes`. Plugin doc:
  `docs/figure-sessions.md`.
- Hosted data: `jbrowse.org/demos/brca1/` (every missense SNV, residue mean
  bigWig) and `tp53_sge/` (every missense SNV, position mean bigWig).

## What the three reviews said

In `/var/tmp/hero-figures/review/` (a cold reviewer of the eight figures, a
blinded ideator given only a capability sheet, a landscape survey):

- No surveyed tool (UCSC, Ensembl, gnomAD, cBioPortal, COSMIC-3D, ProtVar,
  MaveDB, G2P, AlphaFold DB) puts nucleotide-level tracks in a genome browser
  linked to a structure.
- The cold reviewer ranked the pairs snca_e46k 7.5, brca1_m1775r 6.5,
  tp53_y220c 6, every older figure 4 or below. One hue shared by the codon
  column, its chip and the residue is what carries the link; the MSA panel
  hurts in every figure that has it; sentence callouts dilute.
- Its two concrete upgrades, both now built: SNCA with both fibrils superposed
  so Lys80 sits at the same screen position, and a Y220C figure in three linked
  panels (2XWR with Tyr220 plugging the site, 2J1X with the crevice open, 9S9O
  with rezatapopt in it), opaque surface clipped at the pocket, the scan as the
  only genome track. Note 2J1X carries four stabilizing mutations.
- The ideator's other concepts: two exons holding one zinc atom (TP53 C176 and
  H179 from exon 5, C238 and C242 from exon 7, as two regions with a gap
  marker and dashed distances to the zinc), and an AlphaGenome splice
  prediction against Funk's validated exonic splice SNVs (codons 199 and 137)
  with the skipped exon colored on the fold.

## Next

1. **The heroes are TP53 Y220C and HBB E6V** (PI, 2026-10-28). KRAS G12C
   stays in the gallery. We dropped the TP53 zinc prototype because the scan is
   red across the whole stretch, so its four codons do not stand out, and
   R273H because no R273H crystal with DNA exists except with a suppressor.
2. **Genome evidence that drives the figure.** Colin asked that the linear
   view stay critical. `protein/ccr5_delta32` is the first: three 1000
   Genomes 30x CRAMs streamed from the public S3 bucket (HG00137 Δ32/Δ32,
   HG00101 Δ32/+, HG00096 +/+, genotypes from EBI's 2022 phased panel; the S3
   copies of the 2020 VCFs are empty), over two views of 6MEO (gp120)
   colored by the residues Δ32 loses (185 on; it keeps 1–184,
   adds 31 frameshifted, stops at 215). Builder `/var/tmp/ccr5/bin/`.
   A track of the codons Δ32's shifted frame reads (31 new ones, then a stop
   at 216) carries the step between the missing bases and the missing half of
   the receptor; `/var/tmp/ccr5/bin/frameshift.py` writes them. Maraviroc went: Colin called it an analogy
   beside a consequence. Allele frequency went too, since its interesting
   form is by population ([[no-race-or-ancestry-framed-figures]]), and so did
   ClinVar, which draws the deletion as a green "benign" bar here.
   Panel C draws CCR5's residues 1-184 alone, through Protein3d 1.26.0's
   structure `filter` (`[{ field: 'chain', equal: 'B' }, { field: 'residue',
   lte: 184 }]`, ADR-238's predicate vocabulary). It drew gp120 docked on the
   fragment until Colin asked whether HIV still binds: Δ32 protein misfolds
   and never reaches the cell surface, so gp120 stays in B only.
   `protein/ccr5_delta32_gene` is the same locus as a synteny view
   over `demos/ccr5/`: the Δ32 allele is its own assembly, the deletion is the
   pinch between the PAF's two blocks, and the allele's own CDS ends at its
   premature stop. The design that generalises it is
   `ideas/waiting-on-a-call/a-variant-haplotype-is-a-lane.md`.
   Unbuilt ideas on the same footing: a population-constraint track whose
   depleted stretch lands on an interface, RNA-seq junctions proving an exon
   skip with the skipped residues on the fold, tumor reads at KRAS codon 12,
   a long read phasing two variants in trans.
3. **The painted fold as a supporting layer, not the subject**: a variant pair
   whose wild type is painted by the scan says both what the residue does and
   that the whole map agrees, if the key says what the color means.
4. **TP53's painting has less contrast than BRCA1's**: the Funk scan's mean per
   codon sits near zero over much of the domain, so the 2-class threshold at 0
   paints a mottled dimer.
5. **Occlusion is subtle** in software GL at figure size; worth a headed
   capture before deciding it stays on.
6. **Figures the data supports, unbuilt:** VHL hydroxyproline pocket (1LM8 with
   VH032 4W9H, SGE S111/H115 allelic series), SOD1 H81R, DCLRE1C H35D, PTPN11,
   PTEN.

## Known weaknesses

- Y220C: half of rezatapopt sits under the surface from every direction, so
  panel D shows its two ends; the second lump at the panel's right edge is
  the same molecule. The camera's `radius` clips only the far side, so no
  slab can cut the near wall away. 2J1X and 9S9O carry M133L, V203A, N239Y
  and N268D, away from the pocket.
- A 2026-10-21 review (one agent, checked against the files) ranked Y220C,
  SNCA, KRAS. Its fixes are in: Y220C's arrow on c.659 (it sat on c.658),
  a fainter band so the Y220F dot reads blue, KRAS switch II colored with
  "Pocket closed" in C, the construct mutations in a tutorial footnote,
  SNCA "rod polymorph" and its empty ClinVar row dropped. Still open: KRAS
  shows what the drug needs, not G12C's own effect (KRAS locked on), and
  SNCA's codon labels overprint at the two-region boundary (an LGV
  rendering fault, unfiled). Declined: a wild-type Glu46–Lys80 distance,
  per the trap below.
- HBB E6V: the gene track names the codon E7 (HGVS counts Met1) where the
  pills and legend say Glu6/Val6; the codon track's labels give both. Panel B
  has no residue label, and the "Next molecule's pocket" callout box touches
  panel C's right edge (a smaller `dx` fixes it on the next shoot).
- M1775R's BACH1 peptide in the mutant panel is superposed from 1T15 (1N5O has
  none); the view's title names that source, and the reviewer wants "modeled"
  in large type.
- E46K fibrils are recombinant in-vitro folds; patient-brain folds differ, and
  6CU7 and 6UFR are different polymorphs, so "the fold rearranges" overclaims.
  No segment superposes well (16-residue windows above 4.5 Å; the 80–97 fit
  in the layer plane is 10.7 Å), and the panels share only Lys80's spot and the
  C-terminal strand's direction.
- Older figures: BRAF, CFTR, APOE and F5 show an orange
  "Not in the link" in the alignment toolbar; the Factor V Manhattan reads as a
  haplotype block.

## Traps

- A spec file that fails to parse breaks every capture, since the generator
  loads them all.
- Adding a view shifts `anchor.view` indexes; a residue callout then anchors
  to the wrong panel without an error.
- The website generator has no in-page wait, so a figure whose color arrives
  late depends on the plugin's ready marker covering it; a fixed `delay` shot
  green folds in a different panel each run.
- A component-id mark (`A1JMR`) draws the ligand of every chain, undrawn
  chains included; name one copy by residue (`A:402`).
- A fibril's principal axis of chain centroids can run across the two
  protofilaments; the rung axis is the vector between the closest pair of
  chains.
- An alignments track short enough to pack the reads carrying a deletion out
  of sight shows none of them, and the figure reads as if the sample were
  reference; CCR5's read tracks are 160px and sorted on a base inside the
  deletion for that reason.
- A camera aimed at the face a color occupies overstates how much of the
  protein it is. CCR5's panel B was turned until the kept and lost halves sat
  side by side, which is what the residue counts say (182 kept, 129 lost in
  6MEO chain B; 184 and 168 over the whole 352).
- **`products/jbrowse-web/build` in the primary is stale** (2026-10-20 01:38,
  before the alignments sort took `field`), so the generator with `--port`
  rejected a session current main accepts. The scratch `shoot.mjs` hid it by
  loading the hosted build. Capture without `--port` to build the worktree's
  own, or rebuild the primary's.
- Every protein figure session but `hbb_e6v` still nests the genome view's
  settings under `init`, which main now warns is deprecated.
- A 3 Å distance line's label lands on the residue labels; the wild-type
  Glu46–Lys80 line was tried on SNCA and dropped.
- `/tmp` is a 16 GB quota tmpfs, so run captures with `TMPDIR=/var/tmp/<dir>`.
- A commit message containing "update docs" deploys the site.
- Screen outputs are machine-local scratch: `/var/tmp/hero2/`, `/var/tmp/hero-figures/`,
  `/var/tmp/proto-shots/`, `/var/tmp/sge-screen/`, `/var/tmp/r01-*/`.
