---
name: feature-track-decision-tree
description: The three ladders behind an annotation track — which glyph a feature gets (structural dispatch, not declared type), how much survives the vertical budget (the four named fit rungs and the uniform scale after them), and what colour a box takes (the config-beats-the-file rule) — with the DOT source for each. Read before adding a glyph, touching the fit ladder or the label modes, or for the pattern of degrading in named rungs instead of ad-hoc clamps.
audience: internal
---

# The feature-track decision tree

The commonest track there is — a GFF, a BED, a gene set — and the one whose
decisions are least visible, because they are mostly about **what to give up**.
A pileup decides colours; an annotation track decides what fits.

Three ladders, each resolved in one place:

- **which glyph** a feature is drawn as, decided from its *structure*.
- **how much of it survives** the vertical budget, in four named rungs.
- **what colour** a box takes, under one rule: the config beats the file.

## Which glyph

```dot
digraph glyph {
  rankdir=TB
  node [shape=box fontname=monospace fontsize=10]
  { node [shape=diamond] sem; cds; kids; poly; rep; cont; cdschild }

  f [label="feature", shape=oval]
  f -> sem
  sem [label="semantic type owns a glyph?\n(guide_rna, motif)"]
  sem -> "CrisprGuide / Motif" [label=" yes — a specific meaning,\n not a shape"]
  sem -> cds                   [label=" no"]

  cds [label="isCDS(feature)"]
  cds -> poly [label=" yes"]
  cds -> kids [label=" no"]
  poly [label="has mature-protein children"]
  poly -> "MatureProteinRegion" [label=" yes"]
  poly -> "Box"                 [label=" no"]

  kids [label="has subfeatures"]
  kids -> "Box" [label=" no — a leaf"]
  kids -> cdschild [label=" yes"]

  cdschild [label="a CDS child that itself owns\nmature-protein children"]
  sub [label="Subfeatures\n(stack each child on its own row)"]
  cdschild -> sub [label=" yes — NOT gated on top-level:\n gene → mRNA → CDS → mat_peptide\n is what a GenBank conversion emits"]
  cdschild -> rep           [label=" no"]

  rep [label="top-level && isRepeatRegion"]
  rep -> "RepeatRegion\n(subparts on one row, no parent box)" [label=" yes"]
  rep -> cont [label=" no"]

  cont [label="containerTypes lists this type\n|| children are containers"]
  cont -> sub [label=" yes"]
  cont -> hascds [label=" no"]
  hascds [label="direct CDS child", shape=diamond]
  hascds -> "ProcessedTranscript\n(one row, subParts filtered,\nUTRs implied)" [label=" yes"]
  hascds -> "Segments\n(one row of boxes + intron lines)" [label=" no"]
}
```

**Selection is structural, not type-based, and that is the point.** Neither
`gene` nor any transcript type is enumerated: a gene → mRNA → exon tree is caught
by "children are containers", and any coding transcript — mRNA, `V_gene_segment`,
a prokaryotic gene → CDS, an organism-specific type nobody here has heard of — by
"has a direct CDS child". Custom types therefore work with no configuration,
which is what a format as loosely typed as GFF requires.

`containerTypes` is the single explicit override, and it is checked **first** so
it wins. It is matched case-insensitively like every other type test here,
because it is read twice: the same slot builds the gene-like set for
`showOnlyGenes`, and a case-sensitive test on one side meant the filter admitted
a feature the dispatch then refused to stack.

## How much fits

```dot
digraph budget {
  rankdir=TB
  node [shape=box fontname=monospace fontsize=10]
  { node [shape=diamond] mode; iso; fitq; over }

  mode [label="displayMode"]
  mode -> "normal / compact / superCompact\nheight multipliers + row padding" [label=" sized"]
  mode -> "collapsed: every feature on ONE row,\nALL labels suppressed" [label=" overview"]

  iso [label="geneGlyphMode"]
  mode -> iso
  iso -> "all transcripts"      [label=" all"]
  iso -> "one per gene\n(MANE / RefSeq Select, else\nlongest coding)" [label=" longestCoding"]
  iso -> "by zoom"              [label=" auto"]

  bud [label="maxIsoforms — a budget of ROWS\ncomputed main-thread from geneRowCostPx,\nRE-SPENT in the worker over the real children"]
  iso -> bud

  pack [label="pack rows (layout.ts)\nlabel rows reserved by\ndecideLabelReservations"]
  bud -> pack -> fitq

  fitq [label="fit to display height?"]
  fitq -> onerung [label=" no — one rung, scale 1"]
  fitq -> ladder  [label=" yes"]
  onerung [label="full layout; overflow scrolls"]

  ladder [label="THE FIT LADDER — first rung that fits wins,\nlast rung always returns.\nEach rung is LAZY: the common case\nmaterializes only `full`", shape=box style=bold]
  ladder -> r1 -> r2 -> r3 -> r4
  r1 [label="full — names + descriptions"]
  r2 [label="labels — drop descriptions"]
  r3 [label="decimated — keep a name only where it is\nISOLATED; the whitespace factor is the\nsmallest that fits, found by bisection"]
  r4 [label="bodies — no labels at all"]

  scale [label="one uniform scale over the kept rung:\n>1 grows to fill (capped),\n<1 squeezes (floored so the SHORTEST\nDRAWN box stays visible)"]
  r1 -> scale  r2 -> scale  r3 -> scale  r4 -> scale
  scale -> over
  over [label="still overflowing"]
  over -> "scroll — better than boxes\nshrunk to invisibility" [label=" yes"]
  over -> "done" [label=" no"]
}
```

Three things this ladder is built to avoid.

- **The rungs are named states, not clamps.** Each one is a lazy layout and the
  resolved outcome is one object (`level`, `layout`, `scale`, `contentHeight`)
  so its parts cannot disagree — a scale computed off one rung's height and a
  layout taken from another is exactly the bug the bundle prevents.
- **A bisection needs both ends measured.** The decimation factor is monotone
  (raising it keeps fewer names), so it is bisected — but both ends are *probed*
  rather than assumed, because factor 0 is not known to overflow and the cap is
  not known to fit. Returning an unmeasured bound once hid every label on a
  track the decimation existed for.
- **Fit measures what is on screen.** The rungs' heights are taken over the
  visible features, so a stack the fetch buffer made tall off screen neither
  strips labels nor squeezes the boxes the user is actually looking at.

**The label enum resolves once.** `showLabels` is a single flat enum — `auto`
plus four pinned rungs — rather than a three-way radio and a separate
descriptions checkbox, because that split let `off` hide names while
descriptions kept painting, a state nothing in the UI named. The model resolves
it into concrete booleans, and layout, the RPC, the SVG export and hit-testing
all read those, so the enum itself never crosses the worker boundary.

## What colour a box takes

```dot
digraph colour {
  rankdir=TB
  node [shape=box fontname=monospace fontsize=10]
  { node [shape=diamond] slot; set; frame }

  box [label="one box", shape=oval]
  box -> slot
  slot [label="is it a UTR with utrColor SET?"]
  slot -> "read utrColor" [label=" yes"]
  slot -> "read color"    [label=" no — a UTR with utrColor unset\n falls through to `color`,\n which is UCSC whole-item colouring"]

  "read utrColor" -> set
  "read color" -> set
  set [label="is that slot set?"]
  set -> jexl [label=" yes"]
  set -> file [label=" no"]
  jexl [label="evaluate as jexl/CSS;\na throwing expression degrades\nto an invalid-colour marker,\nnever a failed render"]
  file [label="the FILE's own colour —\nBED itemRgb, inherited up the\nparent chain — else the type default\n(feature vs UTR)"]

  frame [label="colorByCDS && isCDS &&\nstrand && phase defined"]
  jexl -> frame  file -> frame
  frame -> "palette.framesCDS[frame]\nreplaces the fill" [label=" yes"]
  frame -> "keep the fill" [label=" no"]

  stroke [label="outline / connector / strand arrow:\nconnectorColor, unset -> THEMED\ntext.secondary WITH ITS ALPHA"]
}
```

**One rule: an unset slot means nothing asked, so the file gets to speak; any
set value wins.** Because unset is `undefined` rather than a concrete default,
every real colour stays expressible — goldenrod included.

The UTR clause is what makes that rule hold for a whole transcript instead of
for its coding part. Read as coding-only, it broke itself in the worst
direction: with `color: 'red'` on a BED12 track the exon took red and the UTR of
the same transcript took the file's `itemRgb`, so the config beat the file at one
end of a gene and lost to it at the other. The visible cost was a per-feature
colour having to be authored twice — one hosted demo carries the same
300-character jexl in both slots, and the copy in the docs had already drifted
from the copy in the figure.

## What transfers

**Dispatch on structure, not on the name the data gave itself.** A format whose
type vocabulary is open — GFF here, but this is every plugin system, every
document model, every "kind" field — cannot be handled by enumerating types. Ask
what shape the thing *is* (does it have children, do those children have
children, is there a coding part) and the long tail works with no configuration.
Keep exactly one explicit override for the cases structure cannot see, and check
it first so it is a real override rather than a tiebreak. **Then read that
override the same way everywhere**: the one bug this design produced was a
case-sensitive comparison on one of its two readers.

**Degrade in named rungs, lazily, first-that-fits.** The alternative — clamping
a font here, dropping a label there, scaling if it still does not fit — has no
name for the state it lands in, so nothing can test it and no one can describe
it in a bug report. An ordered list of named rungs, each a lazy thunk, gives you:
the common case costs one layout; the outcome is one object whose parts cannot
disagree; the last rung is total, so there is no "nothing fits" branch; and a
screenshot has a level you can name. **The uniform scale comes after the rungs,
not between them** — it is the only continuous knob, and it is bounded at both
ends by things measured off the drawing (the shortest box actually drawn, not a
feature's laid-out extent).

**A cache key must not read a setting that does not change what is cached.** The
per-gene row budget is an RPC cache key, so its label allowance is a *constant*
rather than a read of `showLabels`/`showDescriptions` — reading them would make
a label toggle refetch every region. The worst case leaves a row unspent; it can
never overflow. Same family as the wiggle plugin's raw-versus-effective summary
mode ([wiggle-decision-tree](wiggle-decision-tree.md)): **the drawing side may
resolve; the fetching side may not.**

**A budget spent twice needs its two spenders pinned to each other.** The main
thread estimates what a gene costs in rows and the worker re-spends that budget
over the real children — it has to, since only the worker knows how tall an
isoform really is. Two arithmetics for one rule drift silently and admit an
isoform past the lane the cap exists to fit, so the estimator is exported for
the sole purpose of being tested against the packer. **Where you cannot have one
implementation, have one test that fails when the two disagree** — the same
answer the shader/JS twins reach from the other direction.
