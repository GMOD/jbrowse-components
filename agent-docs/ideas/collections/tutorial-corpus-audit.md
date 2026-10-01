---
name: tutorial-corpus-audit
description: Two passes over website/docs/tutorials/ — three measurements taken 2026-08-31 (nothing starts from scratch, prose per figure, claims that do not survive checking) and the 2026-08-21 structural read (which pages are user guides wearing a tutorial's clothes, and the two that want splitting at a named line). Population genomics ranks last on every measurement. Read before restructuring a tutorial, proposing to dedupe the corpus, or quoting one of its censuses.
---

# The tutorial corpus, audited

Two passes over `website/docs/tutorials/`, kept together because they read the
same pages and their findings land on the same edits. §2-4 are three measurements
taken on 2026-08-31 across the 48 pages there then; §5-6 are the structural half,
from a ten-agent read of the 43 pages there on 2026-08-21. The corpus is 57 pages
today, so a census below is a floor rather than a current count — re-run one
before quoting it.

**Population genomics ranks last on every measurement in §2-4.** The same eight
pages head three different rankings.

## 2. Nothing starts from scratch, and nothing is Desktop

### The Desktop conclusion in that doc is too wide

Recorded there: Desktop figures come from Selenium + Electron whose only capture
is `driver.takeScreenshot()`, Electron's chromedriver has no CDP window commands,
and "every in-app affordance there goes through the native file picker".

First two hold. The third does not — `products/jbrowse-desktop/test/screenshots.ts`
drives `AddGenomePane` by pasting URLs, and `reference/FIGURE_CAPTURE.md`
§"Opening the volvox genome" is a section about doing exactly that.

What is missing is a recorder, and the harness already runs on an X server:

    "screenshots:headless": "xvfb-run --auto-servernum -s \"-screen 0 1920x1200x24\" node test/screenshots.ts --headless"

`ffmpeg -f x11grab` against that display, started before the Selenium script and
stopped after, films the session — the native file picker included, which is a
real X window and the affordance no web tour can show. Needs the display pinned
(`xvfb-run -n`, or `$DISPLAY` read in-script) and the screen even-sided at or
under `VIDEO_OUTPUT_WIDTH`.

Not free: the drawn cursor, `say` chips and caption track are injected by
`video-overlay.ts`, a puppeteer facility. A first Desktop clip ships without
them.

**Proposal.** `desktop/open_a_local_file` — start screen, genome opened, a build
script's own output file opened from disk, track drawing. One clip, linkable from
every page whose build script ends on `npx --yes serve <build>/jbrowse2`.

**Cheaper, first.** Ranks 2 and 3 of that doc's table are already drivable in the
web harness (`test_data/empty.json`, no assemblies; `test_data/hg38_only.json`,
no tracks) and no tutorial tour uses either. A tour opening on `hg38_only.json`
and adding the page's own track by URL is the from-scratch shape without the
Desktop work.

The objection recorded there — a tutorial's data is remote and heavy, so adding
the assembly too is minutes under a cut — stands. The assembly step belongs to
the Desktop clip; the track step belongs to each page's own tour.

## 3. Prose per figure, and numbers from a run

Words of prose per figure-or-video, fences and data/reference sections excluded.

| category | median w/media | worst |
| --- | --- | --- |
| genomes.jbrowse.org | 261 | `genomes_proteins` 275 |
| Synteny & comparative | 319 | `selection_pressure` 1075 |
| Cancer genomics | 380 | `tcga_cohort_mutations` 637 |
| Structural variation | 508 | `dog10k_svs` 752 |
| Epigenomics & single cell | 596 | `scatac_pseudobulk` 1253 |
| **Population genomics** | **655** | `ld_mosquitoes` 1078 |

`genomes.jbrowse.org` is 2.5x denser in figures than population genomics and is
the group to copy.

`<number><unit>` tokens in that same prose:

| page | numbers | words |
| --- | --- | --- |
| `population_cnv` | 48 | 1525 |
| `population_genomics` | 46 | 1660 |
| `dog10k_svs` | 32 | 2256 |
| `mcscan_synteny_grape_peach` | 0 | 1237 |
| `methylation` | 0 | 716 |

### The rule exists; nothing enforces it

`website/CLAUDE.md` §"Prose, captions, cards" already draws the line:

> **Few numbers in prose, and none that assert a result.** A number that _names_
> something (a variant's size, a coordinate, a published cohort size) is fine; a
> number stating an aspect of the data the page could have shown instead is not
> [...] **Keep specific values out of captions and callouts.**

Two checkers could hold it and neither reaches the corpus:

- `check-quoted-figures` pulls every `<number><unit>` out of prose and requires
  it in an `agent-docs/` doc the page links, or the JSDoc of a symbol it names.
  **Scope is self-declaring on `BEGIN GENERATED MEASUREMENT` — three pages carry
  one, all developer-guide perf pages, no tutorial.** So the half of the corpus
  whose numbers come from an analysis run sits outside the checker written for
  numbers copied by hand out of a run.
- Nothing at all reads captions, but **captions are not where the problem is.**
  A first count said 62 of 371 carry a value; applying the rule's own exemptions
  (coordinate, variant size, published cohort size, `N-way` track name, a
  setting the reader sets) leaves 36, and nearly all of those are a window width
  naming the frame. The genuine shape is rare — `sv_callset_review`'s "one
  39.5 kb reconstructed contig" is a `derive` output stated over a frame that
  draws it. **A caption arm is not worth building.** Recorded because the blunt
  grep is the obvious first move and it overstates by ~2x.

**Fix.** Widen `check-quoted-figures` scope from the measurement marker to all of
`tutorials/`, ratcheted from the counts above. The rule needs no writing.

### Which numbers stay

- **Build parameter.** `--fst-window-size 2000`, `--flank 600`, a region, a MAF
  floor. The reader types it.
- **Result.** Block lengths, window counts, sample counts, file sizes. The
  figure carries it; the prose copy rots alone.

One hard case:

- `dog10k_selection`'s `"rules": [0.295]` is a result inside a config
  block, the one place a result cannot be cut. The page already says the line is
  a quantile of its own windows and that rebinning means re-taking it. Pattern
  to copy.

## 4. Claims that do not survive checking

### The prose that should be a figure instead

Both remaining inversion sentences are true, general, and doing a picture's job.
Neither reads visually.

- **Gene flux across an inversion.** One schematic: two arrangements paired in a
  heterokaryotype, crossover products inviable at the breakpoints, a double
  crossover in the interior yielding viable recombinants. Replaces the bullet on
  `ld_mosquitoes` and the equivalent on `population_genomics:73`, both of which
  currently spend three lines on it.
- **Fst decaying outside the breakpoints.** Already drawable from the data on
  the page: `population_genomics`' whole-arm figure has the plateau and the
  breakpoints in the same frame. A marked breakpoint pair on that figure retires
  `:334` entirely.

### The gap on both scan pages

Neither says that **an outlier window is not a test**. Both read peaks off a
genome-wide statistic and name genes under them; neither says the top window of a
scan over tens of thousands is extreme by construction, or that the locus was
chosen from the literature rather than found by the scan. `dog10k_selection:106`
is closest, drawing its line as an explicit quantile of its own windows and
saying so.

### What a cleanup pass must not remove

- `dog10k_selection:106-117` — Fst has no p-value; each group is a set of closed
  populations, so drift inside one breed scores like differentiation across the
  contrast.
- `population_genomics:176-189` — `--window-pi` over a variant-sites-only VCF
  counts missing as invariant, and vcftools counts two chromosomes per inbred
  line; pixy named as the fix.
- `ld_human:200-210` — the deCODE map is used *because* it is pedigree-based,
  with the warning that the LD-derived maps in the same hub cannot check a
  triangle independently. This is the built-in control the tutorials' CLAUDE.md
  asks for.

## 5. Which tutorials are user guides wearing a tutorial's clothes

From a ten-agent read of all 43 pages, 2026-08-21. The factual findings
landed; this is the structural half, which is a set of editorial calls
rather than fixes. `website/docs/tutorials/CLAUDE.md` states the test: "the
test is whether the sections could be reordered without the page breaking.
If they could, it is a user guide wearing a tutorial's clothes."

### Fails, worst first

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
- **`genomes_proteins.md`** — two independent launchers off one menu, three genes
  each demonstrating one capability, plus a comparison table and an install
  section. The opening video already shows all three views connected, so §3 and
  §4 re-derive what §2 demonstrated. `NLRP1` is the gene to spine it on: the only
  one whose figures carry a result rather than a demonstration.
- **`dog10k_svs.md`** — the opening paragraph states the anti-pattern in its own words
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

## 6. The pages that want splitting, at a named seam

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

## Order

§4's two figures are unshot. §3 is a scope change to an existing checker plus a rule
in `docs/tutorials/CLAUDE.md`. §2 is the only real work. §5-6 are editorial calls
on pages that already work, so they wait on someone deciding to take a page
apart; §6 is the cheaper of the two, because each cut is at a line number.
