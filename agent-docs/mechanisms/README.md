---
name: mechanisms-index
description: Index of every doc in mechanisms/, with the transferable idea each one carries. Read this to find a technique statement — the shapes this repo arrived at that another codebase could adopt without the genomics.
---

# Mechanisms index

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

- **The filename is the `name:` slug**, kebab-case, `.md`. One string, so a
  citation and an index row cannot spell the doc differently.
  `generate-doc-indexes.ts` fails on a mismatch — that rule is checked only for
  this directory, since `reference/` predates it.
- These docs describe the tree as it stands, so `check-doc-imports` holds every
  path and identifier in them to resolve. `ideas/` is exempt from that and this
  is not; moving a proposal here means its code references become checked.
- The depth stays where it already is. A mechanism doc points at the
  `reference/` doc or ADR that owns the detail rather than restating it —
  duplicated depth is the drift this repo keeps getting bitten by.
- **A finished extraction names its audience.** `upstreamable-ideas.md` holds
  the test: an extraction is done when the idea has a name outside its JBrowse
  spelling and a reader it reaches. This directory is where that name lives;
  the publishing plan stays over there.

The table is generated from each doc's `description:` frontmatter by
`website/scripts/generate-doc-indexes.ts`. Don't edit between the markers;
write the doc's `description:` instead.

<!-- BEGIN GENERATED MECHANISMS INDEX -->

| Doc | The idea it carries |
| --- | --- |
| [alignments-decision-tree](alignments-decision-tree.md) | The two ladders behind an alignments track — what gets drawn, and what colour it is — as one map with the DOT source for each, plus the four mechanisms that keep them from being re-derived at a call site. Read to orient in the plugin before touching a colour scheme, a draw layer or a gate, or to lift the pattern into another plugin. |
| [draw-pass-registries](draw-pass-registries.md) | The layer-registry technique alignments uses for its draw passes — a shared ordered id list plus an exhaustive Record per consumer — decomposed into the four mechanisms it is really made of, with the precondition that decides whether a display wants one and a scorecard of every display against it. Read before adding a mark to a multi-mark display, before proposing a registry for one, and before declining a registry on the grounds that the backends are "not 1:1". |
| [feature-track-decision-tree](feature-track-decision-tree.md) | The three ladders behind an annotation track — which glyph a feature gets (structural dispatch, not declared type), how much survives the vertical budget (the four named fit rungs and the uniform scale after them), and what colour a box takes (the config-beats-the-file rule) — with the DOT source for each. Read before adding a glyph, touching the fit ladder or the label modes, or for the pattern of degrading in named rungs instead of ad-hoc clamps. |
| [generated-claims](generated-claims.md) | A doc's claims about the code are rendered from the code, and the ones that cannot be are checked instead — the marker-pair mechanic, the one-value-one-home chain behind a published number, self-declaring scope, and the ratchet that lets a convention start with debt. Read before hand-writing a table, a count or a figure into any doc, or when deciding whether a claim wants a generator or a checker. |
| [green-checks-that-cannot-fail](green-checks-that-cannot-fail.md) | Seven checks in this repo passed for structural reasons rather than real ones — a compiler standing in for the memo a sabotage deleted, a census that sampled only while the page was quiet, a drift check silent because all fourteen copies were wrong identically, a branch every page rendered that no page could reach, a geometry invariant held against a polygon the shader does not emit, an oracle cited by directory that never asserted its subject, and a parity test sampling the one region where both spellings agree. The catch for each, and why the class is worth naming outside genomics. |
| [mobx-state-patterns](mobx-state-patterns.md) | Two state-management patterns built and validated here that need nothing from genomics — splitting an autorun into a pure plan and an installer, and answering a lifecycle with one discriminated getter instead of N booleans every caller re-subtracts. Both have a failure story sharp enough to carry the idea, and neither has a name outside this repo. |
| [variants-decision-tree](variants-decision-tree.md) | The ladders behind a variant track — which of the four displays a VCF lands in, and what colour one genotype cell is — as one map with the DOT source for each, plus what transfers: classifying from the datum rather than from the colour it produced, memoizing at the cardinality of the answer, and one slot for mutually exclusive meanings. Read before touching a colour mode, a cell loop or a band, or to see the same problem alignments solves with a precedence ladder solved the other way. |
| [wiggle-decision-tree](wiggle-decision-tree.md) | The three independent questions behind a quantitative track — what the score domain is, what shape draws it, and what colour that shape takes — each resolved in exactly one place, with the DOT source for each and the composition rules that keep the axis, the painter, the legend and the tooltip agreeing. Read before touching autoscale, a plot type, or the multi-wiggle colour model, or for the pattern of a derived setting that must not reach the fetch key. |
<!-- END GENERATED MECHANISMS INDEX -->
