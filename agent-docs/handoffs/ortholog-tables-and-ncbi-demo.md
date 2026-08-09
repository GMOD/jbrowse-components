---
name: ortholog-tables-and-ncbi-demo
description: What a .blocks ortholog table can and cannot express (the adapter pairs any two columns, so all-vs-all is a producer question and not a format one), which all-vs-all ortholog formats are worth adding, and the state of the in-flight migration of the grape/peach/cacao demo off Ensembl Plants and onto NCBI datasets. Read before adding an ortholog format, before touching demos/grape_peach_cacao, or before renaming a refName to make a track resolve.
---

# Ortholog tables, all-vs-all, and the NCBI migration

Two threads that turned out to be one: the grape/peach/cacao demo needed more
genomes, and chasing that surfaced both an assembly-provenance bug and a
long-standing misstatement about what `.blocks` can hold.

## What a `.blocks` table can express

**The format and `MCScanBlocksAdapter` are NOT reference-anchored.** This was
stated the other way round in `multiway_synteny.md` for a long time and is
wrong. `pairRows(colA, colB)` joins exactly the two columns being drawn and
keeps rows where both cells resolve through their BEDs; `pairColumns` resolves
those indices by assembly name. Column 0 is never consulted. So:

- A row with a peach gene and a cacao gene draws a peach-cacao link whether or
  not that row also carries a grape gene.
- A table with no reference column at all loads fine.
- N genomes give all N(N-1)/2 pairs, if the table has the rows.

**What IS reference-anchored is jcvi MCScan.** `jcvi.compara.synteny mcscan`
emits one row per gene of the genome you anchor on, so an ortholog pair with no
counterpart in that genome has no row to live in. Joining several `grape.X`
tables side by side (what `build_grape_peach_cacao_synteny.sh` does) therefore
gives every non-grape pair only the orthologs that pass through grape.

For the figure this matters least where you would expect it to matter most:
`multiway_synteny/blocks_one_vs_all` puts grape on the axis, so every lane is a
direct grape-vs-X alignment. The approximation is confined to the peach-cacao
band of the stacked view.

**OrthoFinder is the all-vs-all producer we already support.**
`Orthogroups.tsv` is inferred over all genomes at once, so a group can contain
peach and cacao and no grape. `scripts/orthogroups_to_blocks.py` converts it and
`docs/tutorials/orthofinder_synteny.md` builds a six-genome view that way. The
tutorial now explains the MCScan/OrthoFinder split under "One reference, or all
against all".

## All-vs-all formats worth considering

Ranked by what they would add that the two above do not:

1. **Ensembl Compara homology TSV** — already has a converter
   (`scripts/compara_to_blocks.py`, used by the wheat/sorghum example). It is
   per-reference-species exports rather than a single all-vs-all file, and the
   exports are not reciprocal (sorghum's file carries wheat; wheat's does not
   carry sorghum), so an all-vs-all view needs one export per species and a
   merge. Cheap to add, no alignment step, and it carries inference metadata
   (`copies`, confidence) the others do not.
2. **OrthoFinder `Orthologues/` per-pair TSVs**, as against `Orthogroups.tsv`.
   OrthoFinder writes a directory of pairwise ortholog files alongside the
   orthogroups, which is a genuine all-vs-all set of DIRECT pairs rather than
   groups. Worth it only if the distinction between "in the same orthogroup"
   and "called orthologs of each other" matters for a figure; otherwise the
   orthogroup table is one file instead of N².
3. **A pairwise-alignment track next to the table, not inside it.** For the
   stacked view's middle band the honest fix is a real peach-cacao alignment
   (minimap2/PAF, the `allvsall_synteny` tutorial's route) as its own track,
   rather than trying to widen `.blocks`. A table of gene ids and an alignment
   are different evidence and should not share a track.

**Not worth it:** widening `.blocks` itself. It is a gene-id table and its
one-cell-per-genome shape is what makes the N-genome stack cheap. Anything
needing per-pair attributes wants a different structure.

## The NCBI migration (in flight)

`scripts/build_grape_peach_cacao_synteny.sh` is committed and fully NCBI-derived
(`3e97aa1999`). One RefSeq accession per species supplies genome, annotation and
CDS, so an assembly and the annotation drawn on it cannot be different builds.

Accessions: grape `GCF_030704535.1` (PN40024, but a NEWER build than the
PN40024.v4 the demo used, so coordinates and gene ids differ), peach
`GCF_000346465.2`, cacao `GCF_000208745.1` (Criollo V2), arabidopsis
`GCF_000001735.4`, poplar `GCF_000002775.5`, tomato `GCF_036512215.1`, citrus
`GCF_000493195.1`.

### Why the migration happened

Adding four species meant regenerating all seven BEDs, because the gene ids are
the join key and a table cannot mix builds. Redeploying those exposed that the
hosted cacao assembly was never what the build script produced: it names
chromosomes I..X, Ensembl Plants names them 1..10, and **all ten chromosome
lengths disagree** (chr1 38,988,864 against 37,323,695). Grape and peach did
match, 22/22 and 191/191 entries name-and-length identical, which is exactly the
kind of partial agreement that makes the odd one out easy to miss.

A BED renamed I<->1 was briefly deployed on the assumption this was a naming
difference. It is not, and the failure mode is the dangerous one: genes drawn at
another assembly's coordinates, plausible and wrong. Reverted the same hour.

**The rule.** Renaming a refName is legitimate only when the mapping is
unambiguous — an NCBI accession to a chromosome name via `refNameAliases`, where
the accession already identifies that exact sequence and the alias exists
because accessions are unreadable, not because the identity is uncertain.
Mapping between two builds is a guess. Compare `.fai` lengths before translating
anything.

### Gotchas already paid for, all in the script's comments

- **`--key=ID`, never `transcript_id` or `Name`.** gffread names each extracted
  CDS after the mRNA's GFF3 `ID` (`rna-XM_007225519.2`) and jcvi's default
  `--key=ID` writes the same string, so the join is exact — verified on peach,
  all 23,134 BED names present in the CDS set. NCBI carries `transcript_id` and
  `Name` too, and jcvi silently falls back to a generated `mrna_494685` for
  both, producing a BED that joins to nothing.
- **Filter organelles and strand `?` before gffread**, which treats both as
  fatal: `?` (trans-spliced plastid rps12) exits having written an EMPTY CDS
  file, and a mitochondrial gene whose coordinate runs past its own circular
  sequence (arabidopsis `rna-DA397_mgp37`) exits with "improper genomic
  coordinate". The drop list is NCBI's own `assignedMoleculeLocationType` from
  the sequence report.
- **The track's `assemblyNames` lists only assemblies the config declares.**
  Naming an undeclared one makes the stacked `LinearSyntenyView` fail to resolve
  the track and all three rows come up "No tracks active". Blocks-only mates
  live in the adapter, which is what draws their lanes in an LGV.

### What is left

1. Finish the build (7 gffread + 6 LAST pairs) and check per-column occupancy.
2. Host from the build: three assemblies (bgzip FASTA + `.fai` + `.gzi`), three
   sorted/tabixed gene GFF3s, seven BEDs, `grape.blocks.gz`, and the
   `*.aliases.txt` the assemblies reference.
3. Rewrite `demos/grape_peach_cacao/config.json` for the NCBI assemblies and
   aliases. Deploy data before config; the deploy script requires the repo copy.
4. **Re-derive the grape window.** `multiway_synteny/blocks_one_vs_all` frames
   `11:1,840,000-1,927,000` on PN40024.v4; the new build's coordinates differ.
   Gene labels become NCBI names.
5. Rewrite the tutorial's Ensembl Plants prose and its prerequisites (`datasets`
   and `gffread` replace `wget` against the Ensembl FTP).
6. Re-render and verify all three figures on this dataset, not just the one
   under review — the stacked view is the one that catches an assembly problem.

### Current deployed state

`grape.blocks.gz` and all seven BEDs on `jbrowse.org/demos/grape_peach_cacao/`
are the ENSEMBL-keyed build with four extra species. Grape and peach resolve;
cacao does not, because its hosted assembly is the other build. The cacao lane
therefore draws EMPTY rather than wrong, deliberately, until the NCBI assemblies
are hosted. `multiway_synteny/blocks_one_vs_all` is marked `answered` in
`screenshot-review.json` with that written out.

**The bucket has no versioning**, so the original three-species Ensembl BEDs are
gone and the only way back is a rebuild. See `scripts/deploy-demo.sh`.
