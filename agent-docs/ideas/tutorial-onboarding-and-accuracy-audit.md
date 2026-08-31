---
name: tutorial-onboarding-and-accuracy-audit
description: Four measurements over all 48 tutorial pages — which JBrowse a page names, how much prose it carries per figure, which of its numbers came from an analysis run, and which claims do not survive checking. Population genomics is last on all four. Includes the figures that should replace the prose, and why "Desktop cannot be filmed" is narrower than recorded.
audience: internal
---

# Tutorial onboarding and accuracy audit

Measured across `website/docs/tutorials/` on 2026-08-31. Structure is not here:
`ideas/tutorial-structure-audit.md` holds the reorderability findings.

**Population genomics ranks last on every measurement below.** The same eight
pages head three different rankings.

## 1. No destination named

`check-prereq-tools` asserts every tool a `## Prerequisites` names gets run on
the page. Nothing asserts the reverse.

| | count |
| --- | --- |
| pages linking neither quickstart | 21 / 48 |
| of those, ending on `npx --yes serve <build>/jbrowse2` | 11 |
| of those, mentioning **Add track** anywhere | 1 |

    allvsall_synteny, analyze_trio, cancer_sv, display_settings, dtu,
    genomes_basics, genomes_pangenome, genomes_proteins, genomes_synteny,
    hic_structural_variants, homoeolog_synteny, k562_fusions, ld_human,
    ld_mosquitoes, mappability_qc, multiway_synteny_grape_peach_cacao,
    population_genomics, repeatmasker_classes, selection_pressure,
    sv_callset_review, sv_contact_maps

The dominant ending is a **third route** that is neither quickstart: the build
script downloads its own JBrowse, writes a config into it, and the reader serves
that directory. Every one of those scripts also writes plain local files, which
is the Desktop case, and the page does not say so.

Two pages already carry the line. `population_cnv` §Prerequisites, first bullet:

> a JBrowse instance to paste a track into (see the web quickstart, or the
> desktop quickstart: every file here is a URL, so Desktop needs nothing hosted)

`dog10k_selection` §Prerequisites, closing sentence:

> The scripts write local files, which JBrowse Desktop opens by path and JBrowse
> Web takes through **Add track**.

**Landed 2026-08-31.** One bullet on 15 pages, in whichever of those two shapes
matches the data; `display_settings` already named both apps and grew the links;
`sv_callset_review` scopes its line to the one section that opens a browser.
**21 → 4.**

The remaining four are `genomes_basics`, `genomes_pangenome`, `genomes_proteins`
and `genomes_synteny`, and they are correct as they stand: each is a click-path
through genomes.jbrowse.org, so the hosted site *is* the destination and the
prerequisite already reads "nothing to install".

**Still to build: `check-prereq-app.ts`**, the mirror of `check-prereq-tools`.
Satisfied by a link to either quickstart, to `basic_usage#opening-tracks`, or to
genomes.jbrowse.org — that third arm is what keeps the four above passing, and a
check without it would push a wrong bullet onto them.

## 2. Nothing starts from scratch, and nothing is Desktop

From `ideas/tutorial-tours-from-scratch.md`: 13 of 21 tours open with the data
already drawn, one opens on an app with nothing in it, none opens on an app with
no assembly.

### The Desktop conclusion in that doc is too wide

Recorded there: Desktop figures come from Selenium + Electron whose only capture
is `driver.takeScreenshot()`, Electron's chromedriver has no CDP window commands,
and "every in-app affordance there goes through the native file picker".

First two hold. The third does not — `products/jbrowse-desktop/test/screenshots.ts`
drives `AddGenomePane` by pasting URLs, and `reference/DESKTOP_SCREENSHOTS.md`
§"Opening the volvox genome" is a page about doing exactly that.

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
the 11 pages in §1.

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

Worked example of the prose case:

    scripts/build_dog10k_wolfdog_ancestry.sh:284
    echo "Wolf blocks per animal on $CHROM (count, median kb, longest kb):"

`local_ancestry` states the Tamaskan's longest as 1.5 Mb, the Shiloh Shepherd's
as 17.5 Mb, every other breed as stopping at 2.4 Mb — three figures transcribed
from a run nobody can re-take, on a page whose figure shows the contrast.

**Fix.** Widen `check-quoted-figures` scope from the measurement marker to all of
`tutorials/`, and add a caption arm, both ratcheted from the counts above. The
rule needs no writing.

### Which numbers stay

- **Build parameter.** `--fst-window-size 2000`, `--flank 600`, a region, a MAF
  floor. The reader types it.
- **Result.** Block lengths, window counts, sample counts, file sizes. The
  figure carries it; the prose copy rots alone.

Two hard cases:

- `dog10k_selection`'s `"significanceLine": 0.295` is a result inside a config
  block, the one place a result cannot be cut. The page already says the line is
  a quantile of its own windows and that rebinning means re-taking it. Pattern
  to copy.
- `local_ancestry`'s 17.5 Mb against 2.4 Mb is a result and the page's finding.
  It goes; the figure replaces it. If the Shiloh row is not visibly unlike every
  other breed row, the figure is what needs fixing.

## 4. Claims that do not survive checking

Fixed 2026-08-31, each edit net shorter than what it replaced:

| page | was | now |
| --- | --- | --- |
| `ld_human` | "the 89 kb of _LCT_ and _MCM6_ that selection acted on" | `rs4988235` named as an enhancer variant in _MCM6_ intron 13 |
| `ld_mosquitoes` | "arrangements **cannot recombine** in a heterozygote" | crossing over suppressed in a heterokaryotype; gene flux still crosses |
| `population_genomics` | caption: "the joint trough being the hard-sweep signature" | caption stops at the observation |
| `population_genomics` | "a few megabases past each breakpoint, the margin Corbett-Detig & Hartl report" | differentiation decays outside the breakpoints |

Why each was wrong:

- **89 kb** is the span of the two gene bodies. Selection acted on one
  regulatory variant, and the swept haplotype is far wider than the two genes —
  which is what the triangle in the same figure draws. The page was arguing
  against its own picture.
- **"cannot recombine"** overstates suppression. Gene flux (double crossovers,
  gene conversion) crosses between arrangements and reaches an inversion's
  interior more than its breakpoint-proximal regions, so LD and differentiation
  across a long inversion are not expected to be uniform. `ld_mosquitoes:204`
  then read its figure as uniform and stated it as mechanism; it now names the
  thinning the table was built at (one variant per 50 kb, 0.2 MAF).
- **hard sweep** contradicts Schmidt et al. 2010, cited two paragraphs above,
  which describes staged adaptation at _Cyp6g1_ — and the page's own prose says a
  duplication is still segregating alongside the resistance allele.
- **"a few megabases"** was a citation-shaped number, unverified against the
  paper, restating what the caption two lines up already says.

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

## 5. SV review

`ideas/multihop-sv-review-portal.md` §"Where this stands", §"Cards for a callset
with no chains", §"Sorting the queue is what makes it finishable".

## Order

§1 is one line per page plus a ratchet, widest reach. §4's edits are landed; its
two figures are unshot. §3 is a scope change to an existing checker plus a rule
in `docs/tutorials/CLAUDE.md`. §2 is the only real work.
