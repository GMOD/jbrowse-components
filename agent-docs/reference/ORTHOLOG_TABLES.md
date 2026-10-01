---
name: ORTHOLOG_TABLES
description: What a .blocks ortholog table can express — MCScanBlocksAdapter pairs any two columns, so all-vs-all is a question about the producer — the grape/peach/cacao recipe, and why a refName rename needs a length check first. Read before adding an ortholog format.
kind: dataset
---

# Ortholog tables and the NCBI demo pipeline

How `.blocks` ortholog tables work, which producers give all-vs-all, and the NCBI pipeline
behind `demos/grape_peach_cacao`.

## What a `.blocks` table can express

**The format and `MCScanBlocksAdapter` are NOT reference-anchored.** `pairRows(colA, colB)`
joins exactly the two columns drawn and keeps rows where both cells resolve through their BEDs;
`columnsFor` resolves indices by assembly name and `columnPairs` enumerates the pairs. Column 0
is never consulted. A row with a peach gene and a cacao gene draws a peach-cacao link whether
or not it carries a grape gene; a table with no reference column loads; N genomes give all
N(N-1)/2 pairs if the table has the rows.

**What IS reference-anchored is jcvi MCScan.** `jcvi.compara.synteny mcscan` emits one row per
gene of the anchor genome, so an ortholog pair with no counterpart there has no row. Joining
several `grape.X` tables side by side (`build_grape_peach_cacao_synteny.sh`) gives every
non-grape pair only the orthologs that pass through grape. For `multiway_synteny/blocks_one_vs_all`
(grape on the axis) every lane is a direct grape-vs-X alignment, so the approximation is
confined to the peach-cacao band of the stacked view.

**OrthoFinder is the all-vs-all producer we support.** `Orthogroups.tsv` is inferred over all
genomes at once, so a group can hold peach and cacao and no grape
(`scripts/orthogroups_to_blocks.py`; `docs/tutorials/orthofinder_synteny.md`;
`multiway_synteny_grape_peach_cacao.md` "One reference, or all against all").

**Two answer shapes, one join.** A query with no `targetAssemblyName` fans out to every pair
anchored on the queried assembly, one `mate`-carrying feature per (anchor gene × mate assembly):
what LGVSyntenyDisplay, the region launch and the dotplot get. `MultiWaySyntenyDisplay` regroups
per anchor, so it passes `mateShape: 'grouped'` (a `ComparativeOptions` field, opt-in) and gets
one feature per anchor gene carrying `mates: [{assemblyName, refName, start, end, strand,
orientation, name}, …]`. `groupFeatures` reads either shape. The `pairRows` cache and dedupe are
shared, so the join is unchanged and the saving is objects and bytes (a 47-column, 4,400-gene
whole-chromosome table: 172,207 features / 46.6 MB JSON vs 4,400 / 21.0 MB).

## All-vs-all formats worth considering

1. **Ensembl Compara homology TSV**: converter exists (`scripts/compara_to_blocks.py`, wheat/
   sorghum). Exports are per reference species and not reciprocal, so all-vs-all needs one per
   species and a merge. No alignment step, and it carries inference metadata (`copies`,
   confidence).
2. **OrthoFinder `Orthologues/` per-pair TSVs**: direct pairs rather than groups. Worth it only
   if "same orthogroup" vs "called orthologs of each other" matters for a figure.
3. **A pairwise-alignment track next to the table, not inside it**: for the stacked view's middle
   band the honest fix is a real peach-cacao alignment (minimap2/PAF, the `allvsall_synteny`
   tutorial's route) as its own track. A gene-id table and an alignment are different evidence.

**Not worth it:** widening `.blocks` itself. Its one-cell-per-genome shape is what makes the
N-genome stack cheap; per-pair attributes want a different structure.

## The NCBI pipeline

`scripts/build_grape_peach_cacao_synteny.sh` is fully NCBI-derived: one RefSeq accession per
species supplies genome, annotation and CDS, so an assembly and the annotation drawn on it cannot
be different builds (grape `GCF_030704535.1`, a newer build than PN40024.v4; peach
`GCF_000346465.2`; cacao `GCF_000208745.1`; arabidopsis `GCF_000001735.4`; poplar
`GCF_000002775.5`; tomato `GCF_036512215.1`; citrus `GCF_000493195.1`). Gene ids are the join key
and a table cannot mix builds. Assemblies are the genomes' GenArk hubs, whose chromAlias makes the
`ucsc` column canonical (the ruler reads `chr11`, `chrG7`) and resolves the RefSeq accessions the
BEDs carry. Everything under `jbrowse.org/demos/grape_peach_cacao/` is the NCBI build, and **the
bucket has no versioning**, so the only way back is a rebuild (`scripts/deploy-demo.sh`).

**The rule: a refName rename is legitimate only when the mapping is unambiguous.** An NCBI
accession to a chromosome name via `refNameAliases` is, because the accession already identifies
that exact sequence. Mapping between two builds is a guess. The hosted cacao assembly was once an
Ensembl build naming chromosomes I..X where Ensembl Plants names them 1..10, and **all ten lengths
disagreed** (chr1 38,988,864 vs 37,323,695) while grape and peach matched exactly, the partial
agreement that hides the odd one out. A BED renamed I↔1 on the assumption of a naming difference
drew genes at another assembly's coordinates, plausible and wrong. **Compare `.fai` lengths before
translating anything.**

Gotchas already paid for (also in the script's comments):

- **`--key=ID`, never `transcript_id` or `Name`.** gffread names each extracted CDS after the
  mRNA's GFF3 `ID` (`rna-XM_007225519.2`) and jcvi's default `--key=ID` writes the same string, so
  the join is exact. NCBI also carries `transcript_id` and `Name`, and jcvi silently falls back to a
  generated `mrna_494685` for both, producing a BED that joins to nothing.
- **Filter organelles and strand `?` before gffread**, which treats both as fatal: `?`
  (trans-spliced plastid rps12) exits having written an EMPTY CDS file, and a mitochondrial gene
  running past its circular sequence (`rna-DA397_mgp37`) exits "improper genomic coordinate". The
  drop list is NCBI's `assignedMoleculeLocationType` from the sequence report.
- **The track's `assemblyNames` lists only assemblies the config declares.** An undeclared one
  makes the stacked `LinearSyntenyView` fail to resolve the track ("No tracks active" in all three
  rows). Blocks-only mates live in the adapter, which draws their lanes in an LGV.
