---
name: pangenome-scale-ladder
description: A whole human chromosome now draws as a graph (249 Mb of chr1, 474 nodes, 18 ms) off the hosted bubble tier, and what that took — the bp ceiling is a session prop now, not a constant. Carries one negative that cost a session to find (the tier is a dud on a bacterial rGFA) and one since superseded (`gfatools bubble` returns nothing on a pggb GFA — the snarl-VCF route landed 2026-08-09 and the corollary drawn from it is withdrawn). Read before building another tier or widening a graph cut.
---

# The pangenome scale ladder

What the level-of-detail tier can do as of 2026-08-06, what it cost, and the
things a next session should not re-measure. The **view-side queue** — tier by
`bpPerPx`, expand-on-click, the axis, the UI debts — lives in
`pangenome-graph-next.md` §5–§8 and is not repeated here; this file is the scale
thread specifically. Durable facts land in
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md), "Level of
detail".

## What shipped

`pangenome/hprc_whole_chromosome` draws **all 249 Mb of GRCh38 chr1 as a graph**:
474 nodes, 473 edges, layout 18 ms, off the hosted
`hprc-v2.0-mc-grch38.tier10000` pair. The figure is three lanes from two files —
the bubble file as a variability curve, the same bubbles as the tier's segments
lane, and the tier as the graph.

Nothing was computed for it. HPRC publishes the bubble decomposition, we already
host it, `build_bubble_tier.sh` had already collapsed it, and the tier pair had
been hosted since the level-of-detail work. The only thing in the way was a
ceiling.

## The ceiling was the whole blocker, and it is a session prop now

`MAX_GRAPH_REGION_BP` (5 Mb) is a **proxy for node count**, and only a good one
at segment granularity: 5 Mb of the fine index is 3,034 segments, so refusing by
span was refusing by cost. A tier breaks the proxy — the same 5 Mb is 35 tier
nodes, and a whole chromosome is 474.

`maxRegionBp` is session-settable now (plugin `aee5e17f4b2c`), defaulting to the
same 5 Mb. `maxGraphNodes` is untouched and is the real backstop, because it
counts what actually came back. The **launch menus deliberately keep the
constant**: a user rubber-banding 249 Mb over a fine index should still be told
no, because nothing in that path has said the track is coarse.

If tier-by-`bpPerPx` ever lands, `maxRegionBp` stops needing to be set by hand —
it is the interim mechanism, not the destination.

## Measured — do not re-derive

Node counts off the hosted HPRC tier (`--min-content 10000`), against the fine
index over the same spans:

| span | tier | fine |
| ---- | ---- | ---- |
| whole chr1, 249 Mb | **474** | ~751k segments in the graph |
| 50 Mb | 99 | — |
| 5 Mb | 35 | **3,034** (undrawable) |
| MHC, 6 Mb | 29 | — |

Structure of the chr1 tier, which is what makes the figure's caption checkable:

- **237 backbone nodes alternating with 237 bubbles**, strictly, because
  `gfatools bubble` reports top-level bubbles only and those never overlap.
- Coverage is **0–248.6 Mb with no gap over 1 Mb**. The stretch that *looks*
  empty is not a coverage hole — it is one **18.7 Mb backbone node at
  125.2–143.8 Mb**, the centromere and the 1q12 heterochromatin, where nothing
  varies by enough to pass the threshold. A caption that called it a gap was
  wrong and was corrected; check the file, not the picture.
- **9,444 bubbles on chr1**, segment counts into the hundreds.

The bubble file plots as a curve with **no adapter change**:
`MinigraphBubbleAdapter` already sets `score` to the segment count, and it
extends `BaseFeatureDataAdapter`, which supplies `getRegionQuantitativeStats`
off `scoresToStats`. Only the track *type* changes, because a `FeatureTrack`
does not offer a wiggle display to pick.

## The two negatives, each a session's worth of work

**The tier is a dud on a bacterial rGFA.** Built for the five-strain E. coli
minigraph graph: 601 bubbles → 1,202 nodes at `--min-content 0`, 358 at 2000,
112 at 10000. But the *fine* minigraph index is already only **1,508 segments
for the whole 4.64 Mb chromosome** and 135 over 500 kb, so the tier buys about
4× where HPRC gets ~1,600×. A whole-chromosome cut off the fine index is 2,434
nodes and draws as a hairball, so the tier is still the better of the two — but
the gap is not what the HPRC numbers suggest, and the figure was not worth
shipping. The hosted files exist (see "Left open").

**`gfatools bubble` returns 0 bubbles on a pggb GFA.** It needs rGFA
`SN`/`SO`/`SR` to place a bubble on a reference, and a pggb GFA has bare
S-lines. **This is still true of `gfatools` and no longer blocks a pggb tier —
superseded 2026-08-09**, three days after this file was written. `pggb -V`
writes a `vg deconstruct` snarl VCF whose `LV=0` records are the top-level
bubbles, so `scripts/snarls_to_bubble_bed.py` feeds the same
`bubbles_to_tier_bed.py` with nothing downstream changed. The whole 4.64 Mb
E. coli graph is **1,088 nodes in 51 kB** at `--min-content 50`, hosted as
`ecoli_pggb.tier50`. See
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md), "Level of
detail" — that is the current account, including the `<source>@<refStart>` id
qualification a repeat-folded graph needs. BubbleGun and `vg mod -u` were the
alternatives priced here and neither was needed.

**The corollary this file drew from that is therefore withdrawn.** It read: "can
the whole-chromosome pggb projections have a graph panel — **no**, the pggb
graph has no tier." It has one now. `depth`, `pav` and `untangle_rows` stay
pggb-derived and whole-chromosome, and the half of the reasoning that still
stands is only that pairing them with a *minigraph* tier would mix builders the
tutorials keep apart — which the pggb tier does not do. Anyone who read this
section as a closed door should re-open it.

## Left open

In the order I would take it:

1. **Tier by `bpPerPx`**, then **expand-on-click** — the tier node id *is* the
   bubble's source segment, so expanding is a fine-index query over the same
   span with no cross-reference to maintain. Both are `pangenome-graph-next.md`
   §5; this session changed nothing about them except proving the payoff is real.
2. **Orientation is recorded and not drawn.** The tier already carries `cv:i:`
   per bubble and 246 of HPRC's 130,510 are inversion-flagged, so the data is in
   the file the figure already loads. This is also why the E. coli untangle
   inversion lane cannot be paired with a graph panel.
3. **The panels do not share a pixel mapping** (`pangenome-graph-next.md` §6).
   The whole-chromosome figure makes it obvious: curve, tier lane and backbone
   are all on one 249 Mb axis, and the backbone still starts after
   `FIT_PADDING`.

**One decision, not mine to make.** Three E. coli bubble tiers are hosted at
`demos/ecoli_pangenome/ecoli_minigraph.tier{500,2000,10000}.*` (12 objects,
~55 kB) and are referenced by nothing after the figure was dropped. Delete them,
or wire one up if the bacterial ladder is wanted after all; they rebuild in about
two seconds from `build_bubble_tier.sh` over a `gfatools bubble` run, so nothing
is lost by deleting. S3 here has no versioning, which is why this was left rather
than done.
