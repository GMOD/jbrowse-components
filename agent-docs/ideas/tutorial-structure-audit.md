---
name: tutorial-structure-audit
description: Which tutorials fail the reorderability test and what each one's fix is, the two 60 KB pages that want splitting at a named seam, and the four duplication clusters that turned out not to exist. Read before restructuring a tutorial or proposing to dedupe the corpus.
audience: internal
---

# Which tutorials are user guides wearing a tutorial's clothes

From a ten-agent read of all 43 pages. The factual findings landed; this is the
structural half, which is a set of editorial calls rather than fixes.

`website/docs/tutorials/CLAUDE.md`: "the test is whether the sections could be
reordered without the page breaking. If they could, it is a user guide wearing a
tutorial's clothes."

## Fails, worst first

- **`rnaseq.md`** — six sections, four datasets, no section consuming the one
  before it. No control in the first two figures, and it ends on a paste-in
  config rather than a check. **The fix is concrete**: spine it on the MHC class
  III pair (`NELFE` and `SKIV2L`, back to back on opposite strands), which is a
  question a reader can hold. Read height is then how you see the stack, the
  CIGAR is why some reads jump, `XS` is why the arcs are colored, first-of-pair
  strand is the answer, and `samtools view -f 64` counting by strand over each
  gene is the closing check. ACTB and IsoSeq become one figure each if they
  answer something that spine raised. Alternatively move it to `user_guides/`,
  where `alignments_track` already covers half of it.
- **`multiway_synteny_grape_peach_cacao.md:186-340`** — 155 lines of a 497-line
  page, a catalogue of four independent input routes plus a BED recipe, sitting
  between "Producing the data" and "Setting up the assemblies". Two of the four
  duplicate pages it links.
- **`orthofinder_synteny.md`** — puts its results before the pipeline that
  makes them: five sections read finished figures that `## Producing the blocks
  table` (once `## The conversion`) only later explains how to build, so the
  dependency arrow runs backwards through half the page. Inverting it puts ~150
  lines of bash and JSON ahead of the first figure, which is an editorial call
  against the house show-rather-than-tell order rather than a fix. The dataset
  half of this entry is done and not worth re-proposing: the page visits five
  sets, and each owns one `##` that leads with its organisms and names its set
  id.
- **`scatac_pseudobulk.md`** — three of six sections are self-declared
  alternatives, and `:92-93` says so: "Every route ends the same way ... the rest
  of this page does not care which produced them."
- **`genomes_proteins.md`** — two independent launchers off one menu, three genes
  each demonstrating one capability, plus a comparison table and an install
  section. The opening video already shows all three views connected, so §3 and
  §4 re-derive what §2 demonstrated. `NLRP1` is the gene to spine it on: the only
  one whose figures carry a result rather than a demonstration.
- **`dog10k_svs.md`** — the TL;DR states the anti-pattern in its own words
  ("Five loci, one recipe, a different class of variant each time"; the page has
  four). The `NHEJ1` spine is real. **The cheapest fix is one paragraph**:
  `:237-243` already says "the same track scrolled anywhere else is a screen of
  variants nobody has interpreted yet" — turn that into the question `FGF4`
  answers and the page becomes continuous.
- **`tcga_cohort_mutations.md`** — after "Load it", every heading is an
  independent display setting. `## Cluster the rows instead of grouping them`
  says it replaces the previous section's reading; `## Thin the matrix down to
  recurrent mutations` says it empties the window the histology figure is built
  on. Both belong in `user_guides/multivariant_track` and `clustering`.
- **`ld_mosquitoes.md`** — `:197-208` restates
  `config_guides/variant_track#linkage-disequilibrium-ld-display`, which it links
  in its own opening line. Delete it; move the plink2 note (`--r2 dprime` also
  switches r² to the haplotype-frequency estimate, and plink2 removed `--r2`)
  into the guide, which lacks it.

**On `ld_human` vs `ld_mosquitoes`: keep two pages.** This is the "second dataset
the first raised the question for" case — `ld_human` establishes live r² from a
VCF and runs straight into the fetch gate, and a 22 Mb inversion is past what
live computation reaches, which `ld_mosquitoes:26-28` states as its reason for
existing. What should merge is the *guide* material out of both.

**On the two TCGA pages: keep two, fix the handoff.** Merging gives a ~37 KB page
demonstrating two display types on one cohort, which is the excluded shape. What
is wrong is the link: `tcga_cohort_mutations.md:338-344` is a bare pointer, not a
question the first page raised. The material exists on both pages and is unused —
17q gain confined to the HER2+ row, `TP53` dense in triple-negative. "Copy number
sorts the cohort by amplification; the point mutations sort a group the segments
cannot separate" is the sentence that would make the second page arrive.

**On `scrna_pseudobulk` vs `scatac_pseudobulk`: merge, or split on a different
seam.** They pseudobulk the *same* 10x 5k PBMC donor, and
`scrna_pseudobulk.md:146-148` concedes it: "nothing about the RNA case differs."
If they do not merge, the seam is not RNA-vs-ATAC — it is (a) a user guide on
loading per-group BigWigs as rows, which belongs in
`user_guides/multiquantitative_track`, and (b) one tutorial on pseudobulking the
donor.

## The two pages that want splitting, at a named seam

- **`sv_visualization_cgiab.md`** (53 KB, 25 headings) — cut at line 594, between
  `## Align the tumor assembly to GRCh38` and `## Walkthroughs`. Everything above
  is bash and JSON with almost no figure; everything below is hosted-data
  walkthroughs with fourteen. Six sibling sections between `:161` and `:339`
  shuffle freely. `## Reproduce it end to end` currently sits ~400 lines after
  the data preparation it wraps.
- **`pangenome_ecoli.md`** (61 KB) — cut at `## The graph itself` (line 743),
  which already reads as a second page's title and carries 22.9 KB.
  `### Browsing the whole graph by locus` alone is 15.4 KB, larger than the whole
  `hg002_haplotypes` page. Page B has a real chain: index → tier finds the bubble
  → fine index opens it → carriage says who → the node's menu opens CFT073 → the
  file cut brings the paths back.
- **`pangenome_hprc.md`** (58 KB) — cut at `## The variant callset` (line 855).
  The page announces its own failure at `:51-55`: "opens three of its products".
  The 6.3 KB RepeatMasker excursion at `:460-614` belongs to neither half.

## Duplication: four expected clusters that do not exist

Worth recording, because the obvious dedupe pass would find nothing.

- **bgzip/tabix** — no page carries a paragraph explaining what they do. The rule
  ("link to `quickstart_web.md` for the prep") is being followed.
- **`jbrowse text-index`** — two occurrences corpus-wide, one a command and one a
  link.
- **The `.anchors` explanation** — lives once, on `mcscan_synteny_grape_peach`,
  and the sibling links it.
- **The TCGA "use your own cohort" pair** — already solved by delegation at
  `tcga_cohort_mutations.md:339`, which is the model the rest should copy.

What *is* duplicated is prose whose repetition is load-bearing under the
cold-start rule: the "nothing to read along" bullet (four wordings across ~12
pages), the `UU_Cfam_GSD_1.0` gloss (four pages), the assembly-name sentence
(four pages, each one clause and each already a link). **The win there is
consistency of wording, not removal.** Two exceptions worth an actual fix:

- **The plugin-install subsection, byte-identical on three pangenome pages**
  (`ecoli:751-777`, `hprc:62-91`, `cactus:421-448`), ~1.9 KB, with a
  `<!-- GRAPH_PLUGIN_CONFIG -->` marker already sitting inside it doing half the
  job. Widen the marker to the whole subsection.
- **The `## Reproduce it end to end` fence**, 23 pages, whose only varying token
  is the script name. `include:` cannot own it (`sync-doc-snippets` fills fenced
  blocks from compiled TS/JS), and `check-script-commands` already pins it, so
  this one is correctly left alone.

## One claim that did not survive checking

An agent reported `**Add track**` as missing its ellipsis on seven lines, since
`HamburgerMenu.tsx:66` renders `Add track...`. **Both spellings are real**: the
FAB's menu renders a bare `Add track`
(`HierarchicalTrackSelectorWidget/components/HierarchicalFab.tsx:78`). The docs'
bare form matches a rendered label and was left alone.
