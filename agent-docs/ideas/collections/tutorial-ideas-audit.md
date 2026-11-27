---
name: tutorial-ideas-audit
description: Unwritten tutorial ideas, many built on hosted tracks no page names yet, from sequence tools, GWAS fine-mapping and GenArk to somatic review and two missing build-your-own examples. The four priority tutorials have their own files in ready/.
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
have been filled; check `website/docs/tutorials/` before writing to it.

## The pool: hosted tracks nothing names

Walk `test_data/config_demo.json`'s tracks and grep each `trackId` against every
`.ts`/`.md`/`.astro`/`.json` under `website/scripts/specs`, `website/docs` and
`website/src`: on 2026-08-06, **196 of 262 tracks appeared nowhere**. These are
URLs that already resolve, so a page costs a config and a figure, never an
upload.

**On hg38, reach for the hub before hosting anything.**
`tutorials/mappability_qc.md` is the worked example: what looked like an
hg19-only story off `config_demo.json` is a richer hg38 one off
`jbrowse.org/ucsc/hg38/config.json`. `jb2export --genome hg38 --track hg38-<id>`
is the same catalog from the CLI, and `specs/ld.ts`, `specs/popgen.ts` and
`specs/qc.ts` show the spec form. A `demos/<name>/config.json` earns its keep
only for a set the hub does not assemble: `uniprot_hg38` (34 tracks in one
category tree) and `directrna_isoforms` (a jbrowse.org-hosted BAM).

## Pages with hosted data and no tutorial

**BLAT, in-silico PCR, sequence search, CRISPR guides.** New and valuable, and
the area Colin knows least, so write it against the source and verify by
driving the real UI. GMOD/jbrowse-plugin-blat has `BlatDialog` and
`IsPcrDialog` (two Tools menu items, on any genomes.jbrowse.org genome, which
names the plugin);
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
FLAIR GTF against Gencode to show novel isoform calls and junctions
quantification, past where `rnaseq.md`'s one-paragraph "Short reads vs long
reads" stops.

**A GenArk page.** The three genomes.jbrowse.org pages center on hg38, and
GenArk gets one TP53 search on the axolotl in `genomes_basics`, while the site's
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
annotations, so they read in a linear view without a graph.

**HGSVC 2024.** A whole family unused on hg38 and CHM13 — SNV, indel, symbolic
insdel, inversions, a complex-event BED, `vamos.VNTR` and the PanGenie
genotypes. `population_cnv` loads the HGSVC3 SV calls; the rest is enough for
"one sample, five callsets, which do you believe", overlapping
`sv_multisamples.md`.

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

## The build-your-own examples site

**Two bring-your-own examples nobody has written** (`064dd09cca`): linked
views and base-level sequence. None of the pages under
`products/jbrowse-build-your-own/examples-site/src/examples/` covers them
(session save/restore is `session-in-url`), and that site's arc is one page
adds one thing — see
[lightweight-toolkit](../waiting-on-a-call/lightweight-toolkit.md) for what the
ceremony on each page costs before adding two more.
