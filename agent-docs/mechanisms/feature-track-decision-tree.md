---
name: feature-track-decision-tree
description: What an annotation track decides — which glyph a feature gets, how much of it survives the vertical budget, and what colour a box takes — as three rendered decision graphs, with the failures behind the odd-looking branches kept to a tail. Read before adding a glyph, touching the fit ladder or the label modes.
audience: internal
---

# The feature-track decision tree

The commonest track there is — a GFF, a BED, a gene set — and the one whose
decisions are least visible, because most of them are about what to give up.

Three decisions: **which glyph** a feature is drawn as, **how much of it
survives** the vertical budget, and **what colour** a box takes.

## Which glyph

![How a feature's glyph is chosen](diagrams/feature-glyph.svg)

Selection is **structural**, not type-based. Neither `gene` nor any transcript
type is enumerated: a gene → mRNA → exon tree is caught by "its children are
containers", and any coding transcript — mRNA, a V-gene segment, a prokaryotic
gene → CDS, an organism-specific type — by "it has a direct CDS child". Custom
types work with no configuration.

`containerTypes` is the one explicit override, checked first so it wins. Two
type tests are semantic rather than structural (guide RNAs and motifs), because
those name a meaning rather than a shape.

## How much fits

![The vertical budget and the fit ladder](diagrams/feature-budget.svg)

- `displayMode` sets the body height and padding; `collapsed` puts everything on
  one row and suppresses every label.
- `geneGlyphMode` decides how many transcripts a gene contributes. Under `auto`
  at coarse zoom (>100 bp/px) the worker collapses each gene to one — the
  curated tag, else the longest protein — which is the only isoform decision
  left in the worker.
- Everything else a gene gives up, it gives up on the **main thread**, where the
  pack is visible. The worker ships every isoform with the ordinal of the direct
  child it belongs to and an `IsoformStack` per gene: children in drawn order
  with their rank, their gene-local geometry, and how many isoforms the gene has.
- Where the display fits to height, the **fit ladder** runs: `full` → `labels`
  (descriptions dropped) → `isoforms` (each gene trimmed to the count that fits
  WITH its names) → `decimated` (a name only where it is isolated) → `bodies` (no
  labels). The first rung that fits wins, each rung is laid out lazily, and the
  last always returns.
- The `isoforms` rung bisects the transcripts-per-gene the track can hold. It
  sits above `decimated` because the policy is **names before isoforms**, and
  when even one per gene overflows the two rungs below inherit that 1 rather than
  going back to the full stack to save a name. A fixed-height track runs the
  short ladder `full` → `isoforms` and scrolls; `grow` never trims, because its
  height IS its content's.
- One uniform scale then grows or squeezes the kept rung, floored so the
  shortest **drawn** box stays visible. Past that, the track scrolls.

`showLabels` is a single flat enum — `auto` plus four pinned choices — that the
model resolves into concrete booleans. Layout, the RPC, the SVG export and
hit-testing read those, so the enum never crosses the worker boundary.

## What colour a box takes

![How a feature box's colour is resolved](diagrams/feature-colour.svg)

One rule: **an unset slot means nothing asked, so the file gets to speak; any
set value wins.** Unset is `undefined` rather than a concrete default, so every
real colour stays expressible. A UTR reads `utrColor` only when that slot is set
and otherwise falls through to `color`, which is what makes the rule hold for a
whole transcript rather than for its coding part.

Colour-by-frame is applied last, over whatever fill was resolved. Outlines,
connectors and strand arrows take the theme's secondary text colour, alpha
included, unless a slot overrides them.

## Why the odd-looking branches are there

- **The polyprotein test is not gated on top-level.** The same shape appears one
  level deeper — gene → mRNA → CDS → mature peptide, which is what a GenBank
  conversion emits — and dispatch only recurses through the stacking layout, so
  a top-level-only test dropped every cleavage product to a flat box.
- **`containerTypes` is matched case-insensitively** because it is read twice:
  the same slot builds the gene-like set for the "only genes" filter, and a
  case-sensitive test on one side admitted a feature the dispatch then refused
  to stack.
- **Both ends of the decimation bisection are probed**, not assumed. Factor 0 is
  not known to overflow and the cap is not known to fit; returning an unmeasured
  bound once hid every label on a track the decimation existed for.
- **The fit rungs measure the features on screen**, so a stack the fetch buffer
  made tall off screen neither strips labels nor squeezes the boxes the user is
  looking at.
- **The squeeze floor is built on the shortest drawn box**, not on a feature's
  laid-out extent: a gene's extent is every stacked transcript plus its label
  rows, so a floor built on it promised 2px boxes.
- **The isoform count is solved after the fetch, not before it.** It was a
  pre-fetch estimate for two releases, and no pre-fetch estimate can price what
  a gene shares its row with: a strand arrow is 8px of layout width the worker
  never sees, so two genes 4px apart in bp stacked anyway and a 145px track
  landed on `bodies` with every name gone (ADR-092).
- **A UTR read as a separate colour broke its own rule**: with a `color` set on a
  BED12 track the exon took it and the UTR took the file's `itemRgb`, so the
  config beat the file at one end of a gene and lost at the other.

## What transfers

**Dispatch on structure, not on the name the data gave itself.** A format whose
type vocabulary is open cannot be handled by enumerating types. Ask what shape
the thing is — does it have children, do those children have children, is there
a coding part — and the long tail works unconfigured. Keep one explicit override
for what structure cannot see, check it first, and read it the same way
everywhere: the one bug this design produced was a case-sensitive comparison on
one of its two readers.

**Degrade in named rungs, lazily, first-that-fits.** Clamping a font here and
dropping a label there has no name for the state it lands in, so nothing can
test it and nobody can describe it in a bug report. An ordered list of named
lazy rungs gives you a one-layout common case, an outcome whose parts cannot
disagree, a last rung that is total, and a screenshot with a level you can name.
The continuous knob comes after the rungs, bounded at both ends by things
measured off the drawing.

**A cache key must not read a setting that does not change what is cached.**
Same family as the wiggle plugin's raw-versus-resolved summary mode
([wiggle-decision-tree](wiggle-decision-tree.md)): the drawing side may resolve;
the fetching side may not.

**Decide where you can measure, not where the data is cheapest.** The isoform
count was decided in the worker because that is where the child list lives, and
it was a promise about a lane only the main-thread packer can see. Two
arithmetics for one rule — an estimator on one side, a re-spend on the other —
drift silently, and pinning them to each other only proves they agree, not that
either is right. One spender, on the side that can measure the answer, needs no
mirror and no test for the mirror.
