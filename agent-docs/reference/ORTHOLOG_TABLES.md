---
name: ortholog-tables
description: What a .blocks ortholog table can express — MCScanBlocksAdapter pairs any two columns, so all-vs-all is a question about the producer — the grape/peach/cacao recipe, and why a refName rename needs a length check first. Read before adding an ortholog format.
kind: dataset
---

# Ortholog tables and the NCBI demo pipeline

How `.blocks` ortholog tables work, which producers give all-vs-all, and the NCBI
pipeline behind `demos/grape_peach_cacao`.

## What a `.blocks` table can express

**The format and `MCScanBlocksAdapter` are NOT reference-anchored.**
`pairRows(colA, colB)` joins exactly the two columns drawn and keeps rows where
both cells resolve through their BEDs. Column 0 is never consulted: a row with a
peach gene and a cacao gene draws a peach-cacao link whether or not it carries a
grape gene, and N genomes give all N(N-1)/2 pairs if the table has the rows.

**What IS reference-anchored is jcvi MCScan.** `jcvi.compara.synteny mcscan`
emits one row per gene of the anchor genome, so an ortholog pair with no
counterpart there has no row. Joining several `grape.X` tables side by side
(`build_grape_peach_cacao_synteny.sh`) gives every non-grape pair only the
orthologs that pass through grape. For `multiway_synteny/blocks_one_vs_all` every
lane is a direct grape-vs-X alignment, so the approximation is confined to the
peach-cacao band of the stacked view.

**OrthoFinder is the all-vs-all producer we support.** `Orthogroups.tsv` is
inferred over all genomes at once, so a group can hold peach and cacao and no
grape (`scripts/orthogroups_to_blocks.py`;
`docs/tutorials/orthofinder_synteny.md`).

**An orthogroup cannot say which subgenome a donor gave.** A polyploid's
homoeologs share one orthogroup, so tauschii (the D donor) links to wheat's A, B
and D chromosomes in near-equal numbers, and coloring a wheat stack by subgenome
to show "tauschii lands on D" draws nothing true. What orthogroups do show is
copy number: one region against two or three copies, which the OrthoFinder
tutorial is built on. Subgenome origin needs sequence identity (a PAF track),
not a gene-id table.

**Between two multi-copy genomes, `--pick expand` pairs copies arbitrarily.**
`orthogroups_to_blocks.py` index-pairs a cell's copies (row i takes copy
i mod n), which is every link where one side has one gene and OrthoFinder's
listing order where both have several. On the hosted wheat table (2026-11-08)
the share of links joining different subgenome letters was:

| Band         | Cross-subgenome links |
| ------------ | --------------------- |
| wheat–durum  | 48% of 69,812         |
| wheat–emmer  | 44% of 77,092         |
| durum–emmer  | 20% of 52,756         |

That is near chance for two against two. The `wheat_blocks` track (MCScanX_h
over the full product of each cell, `--homology`) does not fix it: homoeologs
keep their gene order too, so MCScanX_h chains the true block and the homoeolog
block at nearly every locus. Its A/B-only blocks on the same hosted build:

| Band         | Same-letter share of drawn length | Off-letter length a same-letter block also covers |
| ------------ | --------------------------------- | ------------------------------------------------- |
| wheat–durum  | 53%                               | about 54% (wheat D has no same-letter partner)    |
| wheat–emmer  | 55%                               | about 54%                                         |
| durum–emmer  | 53%                               | 98%                                               |

The build script orders the wheat rows tauschii, wheat, urartu, durum, emmer,
so the only band between two polyploids is durum–emmer, and the wheat set alone
passes `mcscanx_to_anchors.py --drop-overlapped-blocks`: densest first, a block
is dropped when more than half its own span on either genome lies inside one
already kept, density being anchors over the mean gene count of the two spans.
Measured on the same hosted PAF (A/B only):

| Band        | Same-letter share, before | After | A/B covered by same-letter blocks, after |
| ----------- | ------------------------- | ----- | ---------------------------------------- |
| wheat–durum | 52.6%                     | 96.4% | 95.2%                                    |
| wheat–emmer | 54.8%                     | 99.7% | 96.1%                                    |
| durum–emmer | 52.5%                     | 98.3% | 96.7%                                    |

Two first tries failed: overlap measured against the shorter block let a short
dense block knock out the long block around it (coverage fell to about 31%),
and genes per bp let a D homoeolog block win on its physically shorter
chromosome. Wheat D's blocks against the tetraploids mostly go, since D has no
same-letter partner there. The flag stays off elsewhere: on rice–maize it cuts
rice covered by two or more maize blocks from 58.9% to 12.3%, and on
coffee–tomato coffee covered by three or more tomato blocks from 11.1% to 0.3%,
the multi-copy pairings the grasses and nightshade figures show. The hosted
wheat PAF changes only when the set is rebuilt.

**GrainGenes' own MCScanX runs show the same shape, and our converter reads
them.** GrainGenes publishes a `.collinearity` and `.gff` pair (MCScanX tags
`Cb` and `Tb`) for each wheat-pangenome variety against the three _Ae.
tauschii_ lineage references, at
`https://avena.pw.usda.gov/GG3pangenome/wheat/D/tauschii_files/zip/<ref>-<variety>.zip`
(the list is in `taus_synteny.php`; `pan_synteny.php` has the variety-by-variety
set). On `TA10171_L1-CS2.zip` (Chinese Spring v2.1 against TA10171, 2026-11-08)
the anchors split A 32%, B 31%, D 37% by Chinese Spring subgenome, against 34% on
D in our tauschii–wheat blocks, so the homoeolog chaining is MCScanX's and not
our orthogroup input's. `mcscanx_to_anchors.py --species Cb=CS2 --species
Tb=TA10171` converts the pair unchanged; with `--drop-overlapped-blocks` 237 of
1,092 blocks stay and the D share is 85%, keeping about 27k of the 28k D anchors.
The three tauschii references are not NCBI assemblies; their FASTA and
annotation are on Dryad and Ag Data Commons (Cavalet-Giorsa et al. 2024,
https://doi.org/10.1038/s41586-024-07808-z).

**Two answer shapes, one join.** A query with no `targetAssemblyName` fans out to
every pair anchored on the queried assembly, one `mate`-carrying feature per
(anchor gene × mate assembly). `MultiWaySyntenyDisplay` regroups per anchor, so
it passes `mateShape: 'grouped'` (a `ComparativeOptions` field, opt-in) and gets
one feature per anchor gene carrying `mates: [...]`. `groupFeatures` reads
either; the join is unchanged and the saving is objects and bytes.

**Not worth it:** widening `.blocks` itself. Its one-cell-per-genome shape is
what makes the N-genome stack cheap; per-pair attributes want a different
structure. For the stacked view's middle band the honest fix is a real
peach-cacao alignment (minimap2/PAF) as its own track, since a gene-id table and
an alignment are different evidence.

## The NCBI pipeline

`scripts/build_grape_peach_cacao_synteny.sh` is fully NCBI-derived: one RefSeq
accession per species supplies genome, annotation and CDS, so an assembly and the
annotation drawn on it cannot be different builds. Gene ids are the join key and
a table cannot mix builds. Assemblies are the genomes' GenArk hubs, whose
chromAlias makes the `ucsc` column canonical and resolves the RefSeq accessions
the BEDs carry. Everything under `jbrowse.org/demos/grape_peach_cacao/` is the
NCBI build, and **the bucket has no versioning**, so the only way back is a
rebuild (`scripts/deploy-demo.sh`).

**The rule: a refName rename is legitimate only when the mapping is
unambiguous.** An NCBI accession to a chromosome name via `refNameAliases` is,
because the accession already identifies that exact sequence. Mapping between two
builds is a guess. The hosted cacao assembly was once an Ensembl build naming
chromosomes I..X where Ensembl Plants names them 1..10, and **all ten lengths
disagreed** while grape and peach matched exactly, the partial agreement that
hides the odd one out. A BED renamed I↔1 on the assumption of a naming difference
drew genes at another assembly's coordinates, plausible and wrong. **Compare
`.fai` lengths before translating anything.**

Gotchas already paid for (also in the script's comments):

- **`--key=ID`, never `transcript_id` or `Name`.** gffread names each extracted
  CDS after the mRNA's GFF3 `ID` and jcvi's default `--key=ID` writes the same
  string, so the join is exact. jcvi silently falls back to a generated
  `mrna_494685` for the other two, producing a BED that joins to nothing.
- **Filter organelles and strand `?` before gffread**, which treats both as
  fatal: `?` (trans-spliced plastid rps12) exits having written an EMPTY CDS file,
  and a mitochondrial gene running past its circular sequence exits "improper
  genomic coordinate". The drop list is NCBI's `assignedMoleculeLocationType`
  from the sequence report.
- **The track's `assemblyNames` lists only assemblies the config declares.** An
  undeclared one makes the stacked `LinearSyntenyView` fail to resolve the track
  ("No tracks active" in all three rows). Blocks-only mates live in the adapter,
  which draws their lanes in an LGV.
