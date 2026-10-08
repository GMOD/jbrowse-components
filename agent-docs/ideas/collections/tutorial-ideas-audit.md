---
name: tutorial-ideas-audit
description: Tutorial ideas left from the 2026-07 audit and the 2026-08 re-inventory of the hosted tracks no page names — sequence tools, GWAS fine-mapping, long-read isoforms, a GenArk page, mobile elements, UniProt on the genome, HGSVC 2024, session review, somatic review, changes to the tutorials index, the genomes.jbrowse.org gating trap, and two parked topics. The four priority tutorials have their own files in ready/.
---

# Tutorial ideas

What the 2026-07 audit of the tutorials and the 2026-08 re-inventory of hosted
tracks left unwritten. The four ideas Colin ranked first have their own files:
[serving your lab's data](../ready/tutorial-serving-your-labs-data.md),
[variant interpretation](../ready/tutorial-variant-interpretation.md),
[notebooks](../ready/tutorial-notebooks-python-and-r.md) and
[exporting figures](../ready/tutorial-exporting-figures.md). What people ask for
is [TUTORIAL_DEMAND.md](../../reference/TUTORIAL_DEMAND.md).

**The corpus has more than doubled since the audit**, so a gap named below may
have been filled; check `website/docs/tutorials/` before writing to it. The
corpus's own state is measured in
[tutorial-corpus-audit.md](tutorial-corpus-audit.md).

## The pool: hosted tracks nothing names

Walk `test_data/config_demo.json`'s tracks and grep each `trackId` against every
`.ts`/`.md`/`.astro`/`.json` under `website/scripts/specs`, `website/docs` and
`website/src`: on 2026-08-06, **196 of 262 tracks appeared nowhere**. These are
URLs that already resolve, so a page costs a config and a figure, never an
upload.

**On hg38, reach for the hub before hosting anything.**
`tutorials/mappability_qc.md` is the worked example: what looked like an
hg19-only story off `config_demo.json` is a richer hg38 one off
`jbrowse.org/ucsc/hg38/config.json`. `jb2export --hub hg38 --track hg38-<id>`
is the same catalog from the CLI, and `specs/ld.ts`, `specs/popgen.ts` and
`specs/qc.ts` show the spec form. A `demos/<name>/config.json` earns its keep
only for a set the hub does not assemble: `uniprot_hg38` (34 tracks in one
category tree) and `directrna_isoforms` (a jbrowse.org-hosted BAM).

## Pages with hosted data and no tutorial

**BLAT, in-silico PCR, sequence search, CRISPR guides.** New and valuable, and
the area Colin knows least, so write it against the source and verify by
driving the real UI. `plugins/blat` has `BlatDialog` and `IsPcrDialog` (two
Tools menu items, Desktop only; Web does not bundle the plugin);
`plugins/sequence/src/CrisprGuideAdapter` has `pam`, `guideLength`,
`pamLocation` (3prime for Cas9, 5prime for Cas12a) and `cutOffset`, a canvas
glyph and `CrisprGuidePanel`; `SequenceSearchAdapter`. Documented only in
`user_guides/blat.md`, `user_guides/sequence_search.md` and the generated
`config/CrisprGuideAdapter.md`. State up front that the UCSC-backed tools are
Desktop-first for CORS and Turnstile reasons, and that the guide adapter emits
sequence-property triage metrics (`gcPercent`, `hasPolyT`), not an off-target
score.

**GWAS to a fine-mapped locus.** `GWASTrack` plus `PlinkLDAdapter` /
`PlinkLDTabixAdapter` with LocusZoom-style r² coloring and right-click
re-anchoring of the index SNP. Only a user guide covers it; distinct from
`ld_human.md`, which teaches the triangle at a kb-scale sweep.

**Long-read transcriptome and isoforms.** `NA12878-DirectRNA...minimap2.sorted`,
a whole-genome BAM plus a chr1 CRAM subset, unused. Pair with a StringTie or
FLAIR GTF against Gencode to show novel isoform calls and sashimi
quantification, past where `rnaseq.md`'s one-paragraph "Short reads vs long
reads" stops.

**A GenArk page.** All four genomes.jbrowse.org pages are human, and the site's
fifty thousand assemblies are its reason to exist. `&hubURL=` against a GenArk
hub is the fastest path from nothing to a browser for a plant or animal lab.
Build it to show the long tail — a smaller track set, a genome nobody has a
config for, the annotation as the only track — not the name-index caveat,
which is a rule a reader applies from the accession: `GCF_` hubs carry an
NCBI RefSeq gene track and `aggregateTextSearchAdapters`, `GCA_` generally
neither (15 of 15 against 0 of 13 on a spread sample, including axolotl
`Mex_15411` released both ways). `genomes_basics` and `agents_hosted_data`
already say so.

**Mobile element insertions.** `MEI_Callset_GRCh38.ALL.20241211`,
`Ortho_MEI_GRCh38.ALL.20241211`, `MEI_Callset_T2T-CHM13.ALL.20241211` and the
NA12878 ALU / LINE1 / SVA callsets, all unused. Reference-anchored point
annotations, so they escape the non-reference problem tandem repeats have.

**UniProt protein features on the genome.** 34 genomic-coordinate bigBeds (17
hg19, 17 hg38; the hg38 hub carries `hg38-unipDomain` and fourteen more):
domains, disulfide bonds, transmembrane segments, modified residues, chains,
isoforms. They lay directly under the gene, and `protein_structure.md`'s "How
positions are mapped" is the next click. The variant-interpretation tutorial
uses them; a page of their own would need a control such as a variant in an
unannotated loop.

**HGSVC 2024.** A whole family unused on hg38 and CHM13 — SNV, indel, symbolic
insdel, inversions, a complex-event BED, `vamos.VNTR` and the PanGenie
genotypes. Enough for "one sample, five callsets, which do you believe",
overlapping `sv_multisamples.md`.

## Workflow

**Session sharing and highlight-driven review.** The highlight list, share
links and URL params as one curation workflow. The FAQ covers the mechanics
("Why can't I copy and paste my URL bar", "How does session sharing with
shortened URLs work", "Are my share links reproducible") with no walkthrough
tying them to a review task.

**Somatic SNV and indel review, tumour versus normal.** Build it on the COLO829
ONT R10 data against hg38 that `cancer_sv.md` already runs on
(`specs/cancer_sv.ts`), not the hosted hg19 MinION pair, which would split one
cell line across two assemblies. COLO829 has widespread LOH, so choose loci
empirically.

## The tutorials page itself

**Index the tutorials by feature, generated.** Someone who wants to learn
`LinearMultiRowFeatureDisplay` has to already know it lives in chromhmm,
bxd_qtl, tcga_cohort_cnv and analyze_trio. A generated table in the spirit of
`<!-- doclist -->` avoids a hand-kept list that drifts.

**Promote the FAQ answers that are really workflows.** "How do I make an image
for a publication", "How do I put my data behind a login", "Why do I get a CORS
error when loading remote files", "How do I get (more) categories to filter on
in the faceted track selector". The first two are tutorials in `ready/`; the
faceted-selector one belongs with the portal-operator audience in the serving
tutorial.

## genomes.jbrowse.org

**Half of what a link to that site reaches is decided in another repo.**
`~/src/jb2hubs/website/src/config/features.ts` gates `/synteny`,
`/conserved-gene-order`, `/protein-browser` and `/pangenomes/*` on
`PUBLIC_STAGING`, and a production build serves each as an
`Astro.redirect('/')` — a 200 carrying a `<meta refresh>` stub, which every
status check calls healthy. `check-external-links.ts` now reads the body of our
own page URLs and fails on a stub. Only `/orthologs` of that set is live in
production, and its per-row **Synteny** links are deliberately ungated. Check
the flag before linking anything else there, and expect `/protein-browser` to
overlap `genomes_proteins` when it ships.

**The hub configs name a MafViewer plugin that core also carries.**
`@jbrowse/plugin-maf` is in `products/jbrowse-web/src/corePlugins.ts` since
33dff33a71, which is not in v4.3.0, what production launches point at. So the
`plugins[]` entry is required today. When v5 ships it becomes a bundle fetch on
the critical path of every hosted launch for something core already has, and
`plugins[].url` is the one field that can error-page a whole session. The names
differ (`MafPlugin` vs `MafViewerPlugin`), so PluginManager's name-match guard
does not dedupe them, and the registry's first-wins guard means the core copy
would win anyway. Re-verify against the hosted builds before acting.

## Parked

**Tandem repeats and expansions.** `vamos.VNTR`, `sgdp_memstrs` and
`chm13v2.0_rmsk` are hosted, but per Colin this is not our strength: the
interesting alleles are non-reference and an expansion is hard to read in a
linear view. Revisit only with a rendering answer first (a graph projection or
a per-allele length encoding).

**Three bring-your-own examples nobody has written** (`064dd09cca`): session
save/restore, linked views and base-level sequence. None of the pages under
`products/jbrowse-build-your-own/examples-site/src/examples/` covers them, and
that site's arc is one page adds one thing — see
[lightweight-toolkit](../waiting-on-a-call/lightweight-toolkit.md) for what the
ceremony on each page costs before adding three more.
