---
name: ORTHOLOG_TABLES
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
