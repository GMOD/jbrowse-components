---
name: tutorial-ideas-audit
description: The 2026-07 tutorial audit: the GitHub demand tally, priorities, the two tutorials deliberately removed, the 2026-08 re-inventory of the 196 hosted tracks no page or spec names, and the genomes.jbrowse.org page audit.
---

# Tutorial ideas (2026-07 audit)

Audit of `website/src/pages/docs/tutorials/index.astro` plus the 25 tutorials on
`main`, cross-referenced against the shipped display/adapter tables
(`config_guides/file_types.md`), the gallery, and the hosted tracks in
`test_data/config_demo.json`.

Coverage today: synteny and comparative 7 (three of them pangenome), structural
variation 4, population genomics 4, epigenomics and single cell 4,
transcriptomics and proteins 2, configuration and embedding 3 plus the storybook
card and the cookbook. Comparative genomics is saturated. There is no genes and
annotation section at all, and no tutorial for a whole shipped view type
(Hi-C, circular) or for the newest sequence tooling.

Two tutorials were deliberately removed, so do not re-propose them as written:

- `readpair_heatmap.md` (16250c4b58) - the Cue-style read-pair contact heatmap,
  dropped with its figures, specs, gallery card, and build scripts. A real Hi-C
  tutorial is a different thing and is still open (below).
- `introgression.md` (3be9f8f745) - "screenshot review flagged the three human
  archaic-introgression figures for data-accuracy distrust and a lack of
  negative controls", plus direction to drop the human archaic framing. Nothing
  ships a figure whose claim a reviewer cannot check. The fiber-seq section of
  `methylation.md` is the pattern to copy: the enzyme-treated sample sits above
  the native no-enzyme control in the same figure.

### What shipped since, and what that changes (2026-08-06)

36 tutorials now, in seven sections: synteny and comparative 9, population
genomics 8, epigenomics and single cell 5, structural variation 4, cancer
genomics 4, transcriptomics and proteins 3, configuration and embedding 3.
Cancer genomics is a section the audit did not have.

Closed off the lists below: **Hi-C** is `hic_structural_variants.md`. Everything
else named below is still open, so the lists stand as written. Two of them moved
without closing:

- **The jbrowse-img page is now the UI half only.** `docs/automating.md` grew
  the `init` fields, URL params, embedded `createViewState`, config and session
  files, and a headless/puppeteer section, which is the URL-and-CLI automation
  the proposal wanted demoted anyway. What is left is exporting a figure from
  the app, which is the half Colin asked to lead with. Smaller page than the
  proposal describes.
- **The notebook tutorial is unblocked.** `resolveAssemblies` moved to
  product-core, so `JBrowseApp(assemblies=["hg38","mm39"])` and
  `JBrowseRApp(assemblies = list("hg38","mm39"))` both work; `localFiles` now
  registers on the app widget, not just the single view; both hosts render a
  visible error instead of logging to devtools. `~/src/jbrowse-anywidget/
  examples/` already carries ten notebooks and JBrowseR carries two Colab
  notebooks plus five vignettes, so the website page is a narrative over
  existing runnable material rather than new material. The loop nothing teaches
  is still the loop: compute in the kernel, put the bytes behind a track with
  `add_local_file` (no web server), set `location`, read it back after the user
  pans. Note the two-way half is single-view only — `JBrowseApp`'s
  `view_locations` is read-back only and every config trait rebuilds the app
  (`~/src/jbrowse-anywidget/agent-docs/IDEAS.md`), so do not write the page
  around panning a synteny view from Python.

### Demand evidence (GitHub, pulled 2026-07-26)

The topic list above came from what the code supports. This is what people
actually ask: 382 discussions in Q&A / General / Ideas back to 2020, plus the
600 most recent issues, back to 2023-06. Keyword tally over titles only, so read
it as direction and not as a measurement. Counts are discussions plus issues.

| Topic | Count | Note |
| --- | --- | --- |
| GFF/GTF loading and gene models | 18 + 19 | steady through 2024-2026 |
| Embedding (React, Vue, UMD, iframe) | 26 + 17 | peaked 2023, falling since |
| Assembly setup (FASTA, refNames, aliases) | 19 + 23 | steady |
| Track catalogs, hubs, connections, faceted selector | 10 + 25 | peaked 2023 |
| Text search and `text-index` / trix | 11 + 13 | rising, 2024 heaviest |
| Hi-C | 7 + 7 | steady, low volume |
| Figures and export | 4 + 17 | steady |
| Hosting, CORS, range requests, deploy | 5 + 7 | see caveat below |
| Auth and private data | 3 + 7 | |
| Notebooks (Jupyter, R, anywidget) | 1 + 4 | |
| Variant interpretation | 0 + 0 | |
| Sequence tools (BLAT, PCR, CRISPR) | 1 + 0 | |
| GWAS and LD | 1 + 0 | |
| Conservation and MAF | 0 + 1 | |
| Tandem repeats and STRs | 0 + 0 | |

What this changes:

- **Annotation loading and gene search is the top-demand topic and it is not on
  the priority list.** GFF/GTF plus text-index plus "why can't I search for my
  gene" is the single largest cluster, it is recent, and the answers live
  scattered across `quickstart_web.md`, the FAQ, and `config_guides/`. The
  "annotating and QC-ing a new assembly" idea below is that tutorial. Promote it.
- **Variant interpretation has literally zero support demand.** That does not
  make it wrong, it makes it a capability play rather than a support fix, and
  AlphaGenome is what would make it one. Judge it on whether the figure is
  compelling, not on whether it deflects questions.
- **The notebook tutorial is a forward bet, not demand-driven** (one discussion
  ever). Fine, since the demand cannot exist before the revitalized anywidget
  and JBrowseR ship, but do not expect it to move support volume.
- **Embedding demand is large but mostly answered**, by
  `embed_linear_genome_view.md` plus the storybook, and it is trending down. The
  gap there is currency (framework versions, React 19) rather than a new page.
- **Low counts on hosting and CORS are not evidence of low value.** Those
  questions have FAQ entries that rank in search, and someone who finds the
  answer never files. The tutorial still stands on Colin's call.
- Sequence tools, GWAS, and conservation score near zero, which for the sequence
  tools is expected (the features are new). Do not read it as "nobody wants
  this", read it as "no baseline yet".

Re-run: `gh issue list --repo GMOD/jbrowse-components --state all --limit 600
--json title,createdAt,labels` plus a `gh api graphql` discussions query.

### Priority per Colin, 2026-07-26

**Serving your lab's data.** Explicitly called out as the boring-but-high-value
one. Static hosting (S3, GitHub Pages, plain nginx), CORS and range requests,
where `jbrowse create` output goes, and putting data behind a login. All of this
exists today only as scattered FAQ entries ("How can I setup JBrowse 2 on my web
server", "Should I configure gzip on my web server", "BAM (or other indexed
binary files) do not work on my server", "How do I put my data behind a login",
"Why do I get a CORS error when loading remote files") plus
`config_guides/deploying.md` and `config_guides/authentication.md`. The tutorial
is the walkthrough that turns those into one path, ending at a URL a
collaborator can open. Reuses `quickstart_web.md` for file prep rather than
restating bgzip/tabix.

**Variant interpretation.** High value if the example is good, which is the hard
part rather than the JBrowse part. Everything needed is already hosted in
`config_demo.json`: ClinVar variants and CNVs (both UCSC and NCBI), gnomAD
missense constraint and pLI, gnomAD v2.1 SVs, MANE 1.4, ENCODE cCREs, GDC cancer
variants, UCSC Mastermind, ClinGen gene-disease and haplo/triplosensitivity,
dbSUPER enhancers. Consequence-impact coloring already has specs
(`variants/consequence_impact_1000g`) and clustering has a user guide. Also
consider genomes.jbrowse.org, which is bulk-loaded from UCSC and carries a large
track catalog, so an interpretation walkthrough there needs no new hosting at
all. The open question is the example: pick one variant whose interpretation is
uncontroversial and readable off the tracks, with a negative control (a benign
neighbor, or the same variant in a constrained versus unconstrained gene).

**AlphaGenome, as a plugin rather than a standalone page.** `~/src/dont_care/
alphagenome_browser` (repo name `alphagenome-jbrowse`, last touched Oct 2025) is
the strongest candidate for the variant-interpretation example, because it
predicts the functional consequence rather than looking it up: the reader picks
a variant and gets REF, ALT, and a **delta** track. The delta is a built-in
negative control, since a variant with no predicted regulatory effect draws a
flat one, which is exactly what the removed introgression figures lacked.

Most of the JBrowse side already exists as a plugin. `frontend/src/
AlphaGenomePlugin/` is a real `Plugin` subclass with two pluggable elements:
`LaunchAlphaGenome.ts` extends `LinearVariantDisplay`'s `contextMenuItems` with
"Add variant to AlphaGenome", and `Float32EndpointAdapter` reads the returned
prediction arrays. What makes it a standalone page today is only the shell: a
Vite React app with its own `makeViewState`, header, and help dialog. Extracting
it to a published plugin loadable in Web and Desktop from the plugin store is
the revitalization, and it drops the shell rather than rewriting the plugin.

Backend is `backend/main.py`, FastAPI behind Mangum on a container Lambda (the
`alphagenome` Python dependency is too large for a zip lambda), results cached
in S3 with a DynamoDB token and a one-week expiry. It started as Flask on EC2,
see tag v0.0.1. Known limits to fix or state: one variant per request, outputs
wired for RNA_SEQ and DNASE (the UI also exposes a chip_seq checkbox), ontology
terms passed as a comma-separated string, and the API endpoint hardcoded in
`handlers/runAlphaGenomeHandler.ts`.

Open questions before this is a shippable plugin: the `ALPHAGENOME_API_KEY`
cannot live in a client plugin, so the Lambda proxy stays and becomes
infrastructure we run (same shape as the UCSC BLAT proxy), which brings rate
limits, cost, and the AlphaGenome terms of use into scope. Decide whether the
proxy URL is a config slot so an institution can point at its own deployment.

**Notebooks, Python and R.** `jbrowse-anywidget` (`~/src/jbrowse-anywidget`) and
JBrowseR (`~/src/JBrowseR`) are both being revitalized, so the tutorial should
cover both rather than only the Python side. Today `docs/jbrowse_jupyter.md`
describes the anywidget and six tutorials embed copy-paste snippets, but nothing
teaches the loop: set `view.location`, read it back after the user pans, drive a
synteny view or dotplot through `JBrowseApp`. Note `docs/jbrowse_jupyter.md`
already calls the anywidget the modern replacement for the Dash-based
`jbrowse-jupyter`, so the tutorial should not send readers to the old package.

**jbrowse-img.** No tutorial mentions it. The FAQ has both "How do I make an
image for a publication" and "How do I automatically create screenshots", and
`docs/jbrowse-img.md` is generated from the product README, so the tutorial is
the missing narrative layer: a session to a committed PNG or SVG, batching a
figure panel, and where SVG export fits versus the CLI tool. Our own website
figure pipeline is the existence proof that it works at scale.

Structure it UI first (Colin, 2026-07-26): automating figures from a URL is the
interesting part, but the user interface workflow is what most readers came for,
so lead with exporting from the app and demote URL and CLI automation to a later
section for people repeating a figure across loci or samples. A UI-first page
has to say where to click, and as of 30f997c706 the house convention is that
menu paths are written out with the unicode arrow and checked against the menus
that build them. Prefer the figure recipe dialog wherever a figure exists: it
derives its click-path from the figure's own session link, so it cannot go
stale, which a hand-written path can and repeatedly has.

**BLAT, in-silico PCR, sequence search, CRISPR guides.** New functionality and
valuable, with the caveat that this is the area Colin knows least, so the
tutorial has to be written against the source rather than from memory and then
verified by driving the real UI. On `main` today: `plugins/blat` with
`BlatDialog` and `IsPcrDialog` (two Tools menu items, Desktop only, Web does not
bundle the plugin), `plugins/sequence/src/CrisprGuideAdapter` with slots for
`pam`, `guideLength`, `pamLocation` (3prime for Cas9, 5prime for Cas12a) and
`cutOffset`, its canvas glyph (`plugins/canvas/src/RenderFeatureDataRPC/glyphs/
crisprGuide.ts`), `CrisprGuidePanel` in the LGV, and `SequenceSearchAdapter`.
Documented today only in `user_guides/blat.md`, `user_guides/sequence_search.md`,
and the autogenerated `config/CrisprGuideAdapter.md`. Two honest constraints to
state up front: the UCSC-backed tools are Desktop-first for CORS and Turnstile
reasons, and the guide adapter emits sequence-property triage metrics
(`gcPercent`, `hasPolyT`) and not an off-target specificity score.

### Feature gaps with hosted data and no tutorial

**Hi-C.** `HicTrack` appears in zero tutorials. A 59-line user guide, one
gallery card, and a demo track exist. Content: reading a contact matrix, how
JBrowse picks binning resolution from zoom and how the track menu steps it, the
color ramp, and loop calls loaded as BEDPE (which the file-types table already
labels "Paired/breakend records, e.g. SV calls or Hi-C loops") drawn as arcs
under the matrix.

**GWAS to a fine-mapped locus.** `GWASTrack` plus `PlinkLDAdapter` /
`PlinkLDTabixAdapter` ship with LocusZoom-style r-squared coloring and
right-click re-anchoring of the index SNP. The gallery card
(`gallery/gwas_bmi_fto`) points at a user guide because no tutorial exists.
Distinct from `ld_human.md`, which teaches the triangle at a kb-scale sweep.

**Conservation and multiple alignments.** phyloP 100-way (hg19 and hg38, line
and density variants) is hosted, and the MAF stack (bigMaf, MafTabix, taffy,
codon frames, percent identity) carries a lot of engineering. MAF only ever
appears inside pangenome tutorials, so a conservation-at-a-coding-locus
walkthrough would be the first one where the alignment itself is the subject.

**Long-read transcriptome and isoforms.** Would double the thinnest category.
Hosted: `NA12878-DirectRNA...minimap2.sorted` (whole genome and a chr1 subset).
Pair with a StringTie or FLAIR GTF against Gencode to show novel isoform calls,
sashimi quantification, and where `rnaseq.md` currently stops (its "Short reads
vs long reads" section is one paragraph).

**Annotating and QC-ing a new assembly.** Highest-demand topic in the tally
above, so treat it as priority tier despite where it sits here.
`Tiberius gene predictions` sits in
the demo config next to Gencode v47 and NCBI RefSeq with RNA-seq available as
evidence. Ends with `jbrowse text-index` so the new gene names are searchable,
which no tutorial except `cli_desktop.md` currently touches. This would open a
genes and annotation section on the landing page.

**Non-model organism with no config.** `&hubURL=` against a UCSC GenArk hub is
the fastest path from nothing to a browser for a plant or animal lab, and today
it is a gallery card plus a 46-line user guide. Overlaps with
genomes.jbrowse.org, so decide whether the walkthrough teaches the hub parameter
or the hosted instance, and cross-link the other.

**Mobile element insertions.** `NA12878_ALU` / `_LINE1` / `_SVA` plus
`MEI_Callset_GRCh38.ALL.20241211` and the T2T callset are hosted and unused. Has
the same non-reference caveat as tandem repeats below, but the callsets are at
least reference-anchored point annotations.

### Re-inventory 2026-08-06: the hosted tracks nothing names

Method, so it can be re-run: walk `test_data/config_demo.json`'s tracks and grep
each `trackId` against every `.ts`/`.md`/`.astro`/`.json` under
`website/scripts/specs`, `website/docs` and `website/src`. **196 of 262 tracks
appear nowhere** — not in a spec, not in a doc, not in the gallery. That is the
pool every idea below comes out of, and it is the cheapest pool we have: these
are URLs that already resolve, so a page or a demo costs a config and a figure,
never an upload.

Clusters big enough to carry a page, with the assembly traps that will otherwise
eat a session:

- ~~**Mappability, blacklists and segdups as a QC layer under a call.**~~ Built
  2026-08-06 as `tutorials/mappability_qc.md`, and **not off this config** —
  which is the part worth carrying forward. The proposal was going to run on
  hg19 because `config_demo.json` has eight mappability bigWigs there and none
  on hg38. The hosted hg38 hub already carries a better version of the whole
  layer: Umap and Bismap at four k-mer lengths, single- and multi-read, the
  GIAB low-mappability/segdup regions **and their complement**, ENCODE Blacklist
  V2, GRC exclusions, UCSC unusual regions, panmask, segdups, and gnomAD's
  coverage over 76,156 genomes to read against them. So the page is a click-path
  on genomes.jbrowse.org with no hosting of our own. Check `~/src/jb2hubs`
  (`ucsc2jbrowse/configs/<db>.json`) before proposing to host a track for hg38 —
  the hub carries roughly 600 of them, and `config_demo.json` is the older and
  thinner of the two catalogs.
- **UniProt protein features on the genome.** 34 tracks (17 hg19, 17 hg38),
  zero uses: domains, disulfide bonds, transmembrane segments, modified
  residues, variants, chains, splice isoforms. They are genomic-coordinate
  bigBeds from UCSC, so they lay directly under the gene with no protein
  coordinate mapping involved. Transcriptomics and proteins is the thinnest
  section at 3, and this connects to the two pages already in it — a variant
  lands in a named domain, and `protein_structure.md`'s "How positions are
  mapped" is the next click. Control: a variant in an unannotated loop.
- **Genes and annotation.** `tiberius_grch38`, `gencode_47` and `ncbi_08_24` are
  all hg38, all unused, and are exactly the three tracks the "annotating and
  QC-ing a new assembly" idea above wants. Nothing is missing for it.
- **Variant interpretation, with the assembly trap the audit missed.** On hg38
  you get ClinVar (UCSC, NCBI, and the pathogenic / non-pathogenic SV splits),
  ClinGen haplo / triplo / gene-disease, MANE 1.4 in both RefSeq and Ensembl ID
  flavors, `encodeCcreCombined`, `mastermind_hg38`, `dbsuper`, `snp151_hg38`.
  **The gnomAD tracks are hg19 only** (`missenseConstrained`, `pliByGene`,
  `gnomad_v2.1_sv.sites`), so the constraint half of the argument and the
  ClinVar half cannot sit in one hg38 view off this config.
- **Long-read isoforms.** `NA12878-DirectRNA...minimap2.sorted` as a
  whole-genome BAM plus a chr1 CRAM subset, unused. This is the dataset the
  "`rnaseq.md` needs a finding" entry above is waiting on.
- **Mobile element insertions.** `MEI_Callset_GRCh38.ALL.20241211`,
  `Ortho_MEI_GRCh38.ALL.20241211`, `MEI_Callset_T2T-CHM13.ALL.20241211` and the
  three NA12878 ALU / LINE1 / SVA callsets.
- **HGSVC 2024.** A whole family unused on both hg38 and CHM13 — SNV, indel,
  symbolic insdel, inversions, a complex-event BED, `vamos.VNTR`, and the
  PanGenie genotypes. Enough for "one sample, five callsets, which do you
  believe", though it overlaps `sv_multisamples.md`.

One correction to carry forward: **do not build the somatic SNV/indel page on
the hg19 COLO829 MinION pair** listed under "Workflow and admin" below.
`cancer_sv.md` already runs on COLO829 ONT R10 against hg38 (`specs/cancer_sv.ts`),
and putting the germline-vs-somatic page on the older hg19 alignments splits one
cell line across two assemblies for no gain.

**On hg38, reach for the hub before hosting anything.** The mappability page
above is the worked example: what looked like an hg19-only story off
`config_demo.json` is a richer hg38 one off `jbrowse.org/ucsc/hg38/config.json`,
with no config of ours in the loop at all. `jb2export --hub hg38 --track
hg38-<id>` is the same catalog from the CLI, and `specs/ld.ts`, `specs/popgen.ts`
and `specs/qc.ts` show the spec form (`?config=` + the encoded hub URL). The
demand cases left above are mostly hg38, so most of them should be hub-backed
too — **`variant_interpretation` in particular**, since the hub carries ClinVar,
ClinGen, MANE, cCREs, dbVar's curated SV sets and gnomAD v4.1, which is more
than the `config_demo.json` inventory that idea was written against.

Where a `demos/<name>/config.json` still earns its keep is a set the hub does
not assemble for you: `uniprot_hg38` (34 tracks in one category tree, one click)
and `directrna_isoforms` (a jbrowse.org-hosted BAM, not a hub track).

### Workflow and admin

**Session sharing and bookmark-driven review.** The grid-bookmark plugin, share
links, and URL params as one curation workflow rather than a data type. The FAQ
covers the mechanics ("Why can't I copy and paste my URL bar", "How does session
sharing with shortened URLs work", "Are my share links reproducible") with no
walkthrough tying them to a review task.

**Somatic SNV and indel review, tumor versus normal.** COLO829 MinION tumor and
normal plus their coverage tracks and `truthset_somaticSVs_COLO829` are hosted.
`sv_visualization_cgiab.md` covers SVs only. Caveat from prior work: COLO829 has
widespread LOH, so choose loci empirically rather than by reputation.

**Circular view.** 46-line user guide, no tutorial. Whole-genome SV overview is
the natural subject, probably as a section of an existing SV tutorial rather
than a page of its own.

### Changes to the tutorials page itself

Cheaper than any new tutorial, and some of them raise the value of every
tutorial already there.

**A comparative-genomics chooser: declined by Colin, 2026-08-09**, and filed
under "Tooling, tests and docs" in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) — including the
general rule it produced about navigation aids that route on a key the reader
can already see.

**Badge what a tutorial costs the reader.** Half these pages open a hosted link
and half want pggb, Cactus, or minimap2 run first, and the cards say nothing
either way. One optional frontmatter field in `website/src/content.config.ts`
(`data: hosted | download | pipeline`) rendered on the card in
`src/pages/docs/tutorials/index.astro`. Small change, and it makes the
zero-setup entry points findable.

**Index the tutorials by feature, generated.** Someone who wants to learn
`LinearMultiRowFeatureDisplay` has to already know it lives in chromhmm,
bxd_qtl, tcga_cohort_cnv, and analyze_trio. A generated table in the spirit of
`<!-- doclist -->` avoids a hand-maintained list that drifts.

**Promote the FAQ answers that are really workflows.** "How do I make an image
for a publication", "How do I put my data behind a login", "Why do I get a CORS
error when loading remote files", "How do I get (more) categories to filter on
in the faceted track selector". Nobody finds a procedure in a Q&A list. The
first two are tutorials above. The faceted-selector one pairs with the operator
audience below, which the tally scores at 35.

**The missing audience: the genome portal operator.** Organizing hundreds or
thousands of tracks, categories and metadata for the faceted selector, hubs and
connections. genomes.jbrowse.org and `~/src/jb2hubs` are existence proofs that
we do this, [large-track-catalogs.md](large-track-catalogs.md) covers the
engineering, and the docs teach none of it. Adjacent to the serving
your lab's data tutorial, one tier up in scale.

### The genomes.jbrowse.org pages (2026-08-08 audit)

`genomes_basics`, `genomes_synteny` and `genomes_msa` read against the live
`hg38` hub config, the jb2hubs feature flags, and the JBrowse source for every UI
label they name. What was wrong is fixed. What is left needs a figure or a
decision.

**Half of what a link to that site reaches is decided in another repo.**
`~/src/jb2hubs/website/src/config/features.ts` gates `/synteny`,
`/conserved-gene-order`, `/protein-browser` and `/pangenomes/*` on
`PUBLIC_STAGING`, and a production build serves each of them as an
`Astro.redirect('/')`, which is a **200** carrying a `<meta refresh>` stub. So a
doc could link to a page that no longer exists and every status check called it
healthy. `genomes_synteny` linked to `/synteny` as "the synteny pair index" that
way. `check-external-links.ts` now reads the body of our own page URLs and fails
on a stub. Only `/orthologs` of that set is live in production, and its per-row
**Synteny** links are deliberately ungated, so they work there too
(`jb2hubs/agent-docs/ORTHOLOGS_LAUNCH_FOLLOWUPS.md`). Check the flag before
linking anything else on that site, and expect `/protein-browser` to overlap
`genomes_msa` heavily when it ships.

**The alignment under the conservation signal — built 2026-08-08** as
`genomes_basics`' "The alignment the score came from"
(`genomes_basics/multiz_alignment`), closing the "Conservation and multiple
alignments" idea above. Both of the blockers first written here were wrong, and
how they were wrong is the part worth keeping:

- "the tracks open hundreds of rows tall" was a guess from the sample lists.
  `LinearMafDisplay` defaults to `rowHeight: 0`, which fits rows to the display
  height instead, so depth costs thinness rather than height. Nothing to fix in
  jb2hubs, and the 319-row texture is what makes the figure legible.
- "no multiz100way bigMaf, so the figure has to move" was true but not a
  blocker. The section switches **both** tracks to the 470-way pair rather than
  pairing a 100-way score with a 470-way alignment, and the earlier figures keep
  the 100-way they were shot on.

What the section actually turns on is better than the one it was proposed for.
Two dense columns sit within ~15bp of each other in the same figure and score
opposite ways: under S240 nearly every species differs from human but they all
carry the same base and the score stays positive, while under T256 and G244
fewer rows differ but they disagree with each other and the score goes red.
phyloP counts substitution events on the tree, not rows that differ, and reading
it the density way is the plausible wrong answer the figure disproves.

The third track, `cactus241wayBM`, is dropped in jb2hubs rather than shown, and
the byte measurements behind that are in `getTrackModifications.ts` beside the
rule.

**UniProt in genome coordinates is now used, the rest of the set is not.**
`genomes_msa` gained a section pairing the MSA's CDD overlay with
`hg38-unipDomain` (verified against the UCSC API: Pyrin, NACHT, FIIND and CARD
over NLRP1, minus strand). Fourteen more UniProt tracks are in the same config,
covering chains, disulfide bonds, transmembrane segments, modified residues and
sequence conflicts. That is the "UniProt protein features on the genome" idea
above, reachable off the hosted hub rather than off `config_demo.json`.

**`genomes_synteny` follows two datasets, and the obvious fix is wrong.** Prose
is TNNT3/hs1, the walkthrough figure is FTO/panTro6, and `tutorials/CLAUDE.md`
says one dataset step by step. This used to read "two of its three figures are
already hs1, so re-shoot `genomes_synteny/launch_sequence` on the hs1 track: one
spec edit, a regen and a push." Don't. That spec's own comment records the
review that put it on chimp: a same-species target makes every block
near-identical, so the launched view says nothing a reader could not have
guessed, and the payoff frame needs a ribbon whose gaps are attributable (it is
aimed at an L1HS in an _FTO_ intron, with the flanking repeats named). Mouse was
tried and rejected in the same pass for being too far. Re-shooting on hs1 spends
a slow remote regen to make the figure say less.

The rule it is really in tension with is "show rather than tell", and the page
already resolves it in prose: the section says the figure walks a second pair
because a cross-species target is where the tracks each panel ends up with are
worth following, and that every click is the same on the hs1 track the page
opened with. If this is reopened, the move is a second hs1 frame **added** to
the sequence, not the chimp one replaced.

**All four pages are human.** The site's fifty thousand assemblies are its
reason to exist. A GenArk page would fix that and answer the undecided
"Non-model organism with no config" entry above in favor of the hosted instance.

What it should NOT be built to demonstrate is the no-name-index caveat, which
was the reason first written here. Per Colin (2026-08-09) the RefSeq GenArk
hubs do have gene tracks and are indexed, and the split is the accession
namespace, not a per-assembly accident: `GCF_` is annotated from the NCBI
RefSeq GFF and carries `aggregateTextSearchAdapters`, `GCA_` generally carries
neither. Checked against the live configs on a spread sample of the 50,686-line
`hgdownload.soe.ucsc.edu/hubs/UCSC_GI.assemblyHubList.txt`: 15 of 15 `GCF_`
indexed, 0 of 13 `GCA_`, including the matched pair where one assembly is
released both ways (axolotl `Mex_15411`, `GCF_040938575.1` vs
`GCA_040938575.1`, same sequence and only the RefSeq one searches).

So the caveat is a rule a reader can apply from the accession before clicking,
which is what `genomes_basics` and `agents_hosted_data` now say, and it no
longer needs a page to demonstrate it. A GenArk page has to earn its place on
what the long tail actually shows: a smaller track set, a genome nobody has a
config for, and what you do when the annotation is the only track there is.

**Not a bug, checked: the hub configs name a MafViewer plugin that core also
carries.** `@jbrowse/plugin-maf` is in `products/jbrowse-web/src/corePlugins.ts`
as of 33dff33a71 (2026-05-14), which is **not** in v4.3.0, still `latest` on npm
and what production launches point at. So the `plugins[]` entry is required today
and redundant only on `main`. When v5 ships it becomes a bundle fetch on the
critical path of every hosted launch for something core already has, and
`plugins[].url` is the one field that can error-page a whole session. The two
plugin names differ (`MafPlugin` vs `MafViewerPlugin`), so PluginManager's
name-match guard does not dedupe them, and the registry's first-wins guard means
the core copy would win anyway. Re-verify against the hosted builds rather than
against git before acting.

### Parked

**Tandem repeats and expansions.** `vamos.VNTR`, `sgdp_memstrs`, and
`chm13v2.0_rmsk` are hosted, and the biology is interesting, but per Colin this
is not our strength: the interesting alleles are non-reference and an expansion
is hard to read in a linear genome view. Revisit only if there is a rendering
answer first (a pangenome or graph projection, or a per-allele length encoding),
not as a data-loading walkthrough.

**Fiber-seq.** Already covered as a section of `methylation.md`, including the
no-enzyme control figure. Not a separate tutorial.

**`tutorials/rnaseq.md` still ends on a tour, and the finding it wanted went
somewhere else.** The 2026-08 focus pass asked that page to end on something
biologically interesting rather than "here is some stuff", and named
differential isoform usage with transcript glyphs coloured by a pipeline's call
as the strongest and most mechanically ready option. That option **shipped as
its own page** — `tutorials/dtu.md` builds the GFF3 attribute from ENCODE ENTEx
quantifications through satuRn and paints it with a `jexl:` callback. So the
strongest candidate is spent, `rnaseq.md` closes on "Loading your own RNA-seq
data", and it does not so much as link `dtu.md` from its See also. Either find a
different finding for it or accept it as the tour and make the handoff to
`dtu.md` explicit; do not re-propose the DTU one.

**`tutorials/pangenome_hprc.md` carries both HPRC release 1 and release 2
figures.** Splitting is optional and lowest priority, since the two releases are
the same project.

**Three bring-your-own examples nobody has written**, from a headless one-line
note (`064dd09cca`): session save/restore, linked views, and base-level
sequence. None of the eighteen pages under
`products/jbrowse-build-your-own/examples-site/src/examples/` covers any of
them. That site's arc is one page adds one thing, so each is a page rather than
a section — see [lightweight-toolkit](lightweight-toolkit.md) for what the
ceremony on each of those pages costs before deciding to add three more.
