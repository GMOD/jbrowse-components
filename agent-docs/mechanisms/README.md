---
name: mechanisms-index
description: Index of every doc in mechanisms/, with the transferable idea each one carries. Read this to find a technique statement — the shapes this repo arrived at that another codebase could adopt without the genomics.
---

# Mechanisms index

> **Generated — don't hand-edit the table.** `pnpm autogen` rewrites it from
> each doc's `description:` frontmatter
> ([`website/scripts/generate-doc-indexes.ts`](../../website/scripts/generate-doc-indexes.ts)),
> so fix the doc a row is wrong about, not the row. `pnpm autogen --check` fails
> CI on a stale table, a doc carrying no frontmatter, or a filename that is not
> its `name:` slug.

A **mechanism** is a technique this repo settled on, stated so that a reader
with no genomics could adopt it. The JBrowse code is the evidence; the idea is
the subject. That is the whole difference from `reference/`, where a subsystem
is the subject and the technique is incidental to explaining it.

This directory exists because
[ideas/upstreamable-ideas.md](../ideas/upstreamable-ideas.md) sets the goal —
other libraries copying the ideas, not more people installing JBrowse — and
names the failure case: the ideas do not die with the code, they die *in the
repo*, spread across 200 files addressed to agents editing this tree. A
mechanism scattered through the subsystem doc that happens to use it is not
findable by anyone who does not already know the subsystem.

[rendering-decisions](rendering-decisions.md) is the entry point for the
track-type maps: the decision sequence every display runs, and the one table
saying what a row and a colour mean in each plugin.

The other family here is the **subsystem** a track type sits on top of rather
than one a display runs — a pipeline several plugins share, stated for someone
who does not know which plugin owns it. [split-read-chains](split-read-chains.md)
and [derivative-allele-candidates](derivative-allele-candidates.md) are the pair
that exists, and they read in that order.

## What belongs here

Three tests, all of them:

- **Name the idea without naming the plugin.** "Classify once into a named
  vocabulary, paint from a table" survives the trip; "how the pileup colours
  reads" does not. A doc that cannot state its idea that way is a subsystem
  writeup and belongs in `reference/`.
- **It is built, not proposed.** A shape that exists in the tree and has been
  load-bearing long enough to have a failure story. Something that would be
  good is a parked proposal — `ideas/`, one per file.
- **It carries the failure it prevents.** A technique with no failure story is
  a preference. The failure is what makes the reader recognize their own
  version of the problem, and it is the part that travels furthest.

A subsystem walkthrough earns a place here only when the walkthrough *is* the
demonstration — [alignments-decision-tree](alignments-decision-tree.md) maps a
plugin, but it is filed here because the map's payload is four mechanisms the
plugin happens to demonstrate at scale.

## Conventions

- **A decision graph is a `.dot` under `diagrams/`, and its rendered `.svg` is
  committed beside it** and embedded with a plain image link. A fenced `dot`
  block is a code block wherever the doc is opened, which is a diagram nobody
  sees. `pnpm diagrams` renders both this corpus and the website's;
  `pnpm diagrams:check` (already in CI) fails when a source has been edited
  without a re-render, or when nothing embeds one. The SVG carries the hash of
  the source it came from, so there is no lock file to keep in step.
- **A node label is a name**, not an argument. What the branch is *for* goes in
  the prose under the picture, where it can be a sentence.
- **The filename is the `name:` slug**, kebab-case, `.md`. One string, so a
  citation and an index row cannot spell the doc differently.
  `generate-doc-indexes.ts` fails on a mismatch — that rule is checked only for
  this directory, since `reference/` predates it.
- These docs describe the tree as it stands, so their references are checked:
  `check-doc-imports` resolves every repo path and cross-doc link, and
  `check-doc-removed-symbols` fails on a backticked name that used to be ours
  and is not any more (`reference/` is in that scan too; `ideas/` and the ADRs
  are deliberately not, since they name proposed and superseded symbols on
  purpose). Moving a proposal here means its code references become checked.
- The depth stays where it already is. A mechanism doc points at the
  `reference/` doc or ADR that owns the detail rather than restating it —
  duplicated depth is the drift this repo keeps getting bitten by.
- **A finished extraction names its audience.** `upstreamable-ideas.md` holds
  the test: an extraction is done when the idea has a name outside its JBrowse
  spelling and a reader it reaches. This directory is where that name lives;
  the publishing plan stays over there.

A mechanism's `description:` is its row here, and it is read by someone who may
not know which subsystem demonstrates the idea — so name the idea, not the
plugin it came out of.

<!-- BEGIN GENERATED MECHANISMS INDEX -->

| Doc | The idea it carries |
| --- | --- |
| [alignments-decision-tree](alignments-decision-tree.md) | What an alignments track decides — what colour each read takes, how a colour scheme reaches that answer, and the draw sequence from the too-large gate to the overlays — as three rendered decision graphs, with the failures behind the odd-looking branches kept to a tail. Read before touching a colour scheme, a draw layer or a gate. |
| [carry-the-decision-not-the-rendered-state](carry-the-decision-not-the-rendered-state.md) | A chain where each step derives its input from the previous step's rendered state promotes the medium's padding to signal, once per hop, and it compounds — the three-hop failure that named it, the two preconditions that make a chain vulnerable, why the carried value must be the decision rather than a re-reading of it, and why it needs no filtering against what the medium can hold. Read before deriving one placement from another that a screen, a grid or a rounding has already been applied to. |
| [derivative-allele-candidates](derivative-allele-candidates.md) | How the reads in view become a ranked list of derivative alleles — the grouping key built from the junctions and never the read edges, why a junction tolerance is a distance rather than a grid, mode-seeded clustering against the two clusterings that divide or merge real alleles, and the discipline that keeps the output a proposal rather than a call. Read before touching the grouping key, the tolerance, the support floor or the rank. |
| [draw-pass-registries](draw-pass-registries.md) | The layer-registry technique alignments uses for its draw passes — a shared ordered id list plus an exhaustive Record per consumer — decomposed into the four mechanisms it is really made of, with the precondition that decides whether a display wants one and a scorecard of every display against it. Read before adding a mark to a multi-mark display, before proposing a registry for one, and before declining a registry on the grounds that the backends are "not 1:1". |
| [feature-band-consumers](feature-band-consumers.md) | A panel showing what another panel already draws has two seams available — the other one's shell (model, config, fetch, lifecycle) or its pipeline (payload → layout → fit → paint → pick) — and only the pipeline composes. The nested-child-display attempt that proved it, the four cheapest answers now in tree, the purity precondition that decides whether the seam exists, and the seven rules a band consumer owes with the failure behind each. Read before adding a band to a display, before hosting one display inside another, and before packaging a band's pipeline for a second caller. |
| [feature-track-decision-tree](feature-track-decision-tree.md) | What an annotation track decides — which glyph a feature gets, how much of it survives the vertical budget, and what colour a box takes — as three rendered decision graphs, with the failures behind the odd-looking branches kept to a tail. Read before adding a glyph, touching the fit ladder or the label modes. |
| [generated-claims](generated-claims.md) | A doc's claims about the code are rendered from the code, and the ones that cannot be are checked instead — the marker-pair mechanic, the one-value-one-home chain behind a published number, self-declaring scope, and the ratchet that lets a convention start with debt. Read before hand-writing a table, a count or a figure into any doc, or when deciding whether a claim wants a generator or a checker. |
| [green-checks-that-cannot-fail](green-checks-that-cannot-fail.md) | Eight checks in this repo passed for structural reasons rather than real ones — a compiler standing in for the memo a sabotage deleted, a census that sampled only while the page was quiet, a drift check silent because all fourteen copies were wrong identically, a branch every page rendered that no page could reach, a geometry invariant held against a polygon the shader does not emit, an oracle cited by directory that never asserted its subject, a parity test sampling the one region where both spellings agree, and a whole test run that could not report the exception its framework caught on every pass. The catch for each, and why the class is worth naming outside genomics. |
| [hic-decision-tree](hic-decision-tree.md) | What a contact-matrix track decides — which binsize and which normalization a fetch asks for, where a contact lands and how a cursor gets back to it, and what a raw count saturates against — as three rendered decision graphs, each stated against the naive version it replaced. Read before touching the binsize ladder, the normalization names, the packed payload or the colour saturation point. |
| [maf-decision-tree](maf-decision-tree.md) | What a multiple-alignment track decides — which of two tiers a fetch reads, which of five renderings the rows are painting, what colour one aligned base takes, and how a species becomes a placed row — as four rendered decision graphs, each stated against the naive version it replaced. Read before touching the summary threshold, a row rendering, the cell colour table or the height ladder. |
| [mobx-state-patterns](mobx-state-patterns.md) | Two state-management patterns built and validated here that need nothing from genomics — splitting an autorun into a pure plan and an installer, and answering a lifecycle with one discriminated getter instead of N booleans every caller re-subtracts. Both have a failure story sharp enough to carry the idea, and neither has a name outside this repo. |
| [rendering-decisions](rendering-decisions.md) | The decision sequence every track type runs — the too-large gate, the fetch tier, layout, height, the backend ladder, the layer lists and the overlays — plus the one table saying what a row and a colour mean in each plugin, and which map to read next. Read first when the question is what the program does when it draws a track. |
| [split-read-chains](split-read-chains.md) | How a split read is put back together from the SA tags of the segments that were fetched — the read-order axis every consumer sorts on, the dedup key that separates two passes over one locus, what happens to a segment no view fetched, and why a per-region answer about a chain is an answer about the region. Read before joining alignment records into a chain, before deriving a field from what one fetch saw, or before dropping a segment nothing returned. |
| [synteny-decision-tree](synteny-decision-tree.md) | What a comparative track decides — which surface draws it, what a fetch asks for at this zoom, what colour an alignment takes, and how a ribbon is built and picked — as four rendered decision graphs, with the failures behind the odd-looking branches kept to a tail. Read before touching a level-of-detail tier, a colour mode, the ribbon geometry or the pick index. |
| [variants-decision-tree](variants-decision-tree.md) | What a variant track decides and in what order — which of the four displays a VCF lands in, what the "Color by" slot resolves to, what colour one genotype cell takes, and the draw sequence from filters to overlays — as four rendered decision graphs, with the failures behind the odd-looking branches kept to a tail. Read before touching a colour mode, a cell loop or a band. |
| [wiggle-decision-tree](wiggle-decision-tree.md) | What a quantitative track decides — the score domain, the shape that draws it, and the colour that shape takes — as three rendered decision graphs, each resolved in one place and read by the axis, the painter, the legend and the tooltip alike. Read before touching autoscale, a plot type or the multi-wiggle colour model. |
<!-- END GENERATED MECHANISMS INDEX -->
