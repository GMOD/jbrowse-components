---
name: launch-menu-rename-and-reconstruction-limits
description: What is left after the "Launch" rename and the derivative-allele guidelines — the figures and one tour that still show the old label, and two proposals nobody has started, one of which needs a measurement before it can be judged.
---

# Left over from the Launch rename and the reconstruction guidelines

Landed already: the track-menu twins for the three rubberband-only entries
(consensus, MAF subsequences/species launches, Get sequence), the
`Launch view` → `Launch` rename across code, docs, specs and tours, and the
user guide's *What the reconstruction needs* / *Judging what it lists*
sections plus the tutorial's pointer at them.

## 1. Figures and one tour still show `Launch view`

The specs were renamed, so a **recapture** fixes each of these; nothing else
does. Nobody has run one.

| what | where | why it shows the label |
| --- | --- | --- |
| 4 derivative-allele figures | `cancer_sv` and `sv` pages | `DERIVATIVE_ROUTE_LABEL` is burned into the frame as a caption |
| 2 graph launch-out figures | `graph-ecoli` specs | `{ type: 'box', anchor: { text: 'Launch' } }` draws a red box around the row |
| `rgfa_launch_out_menu.png` | `user_guides/graph_genome_view.md` | the open menu is the subject of the figure |
| the synteny and SV tours | `videos/synteny.ts`, `videos/sv.ts` | the narration **says** the words, so re-filming is the only fix |
| `pangenome_cactus/subgraph_launch.mp4` | `tutorials/pangenome_cactus.md` | same |

The two `{ type: 'click', text: 'Launch view' }` steps left in `specs/ui.ts` and
`specs/sv.ts` are **correct**: they click app-core's `ViewLauncher` button,
which keeps that wording. One label, two unrelated controls — the same trap as
[[two-real-spellings-of-one-menu-label]] read backwards.

## 2. Say why the candidate list is empty on a short-read track

Small, clear, nobody started it. The dialog's empty state currently offers
"navigate to a breakpoint, and widen the window if the reads are long", which
sends someone with a 150 bp library looking for an event their data cannot
express — the first line of the guide's new *What the reconstruction needs*.

The loaded feature arrays carry per-read spans, so a median aligned length under
about a kilobase can say so in the dialog instead. Keep it to the empty state:
the ranked list already prints segment sizes, and a second warning over a list
that has rows is noise.

## 3. Chain in-read deletions, not only SA segments — MEASURE FIRST

The study in [SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) says the sub-10 kb
cliff is a representation, not the grouping: 50 of the 58 missed junctions are
events the aligner wrote as a CIGAR deletion inside one read. Treating a
deletion above some size as a junction would let `computeDerivativePaths` group
them exactly as it groups SA hops, with no other change to the mechanism.

**Do not ship it on the reasoning alone.** Two things could go wrong and only a
run can say whether they do:

- **Routes at ordinary loci.** `minReads = 2` holds control-locus routes to 0.30
  and 0.37 per window today. Two reads sharing a 200 bp germline indel clear
  that floor trivially, so the floor stops protecting the list.
- **Rank.** A high-support germline indel can outrank the somatic route the
  reader came for, and rank-1-or-2 is what the guide now tells people to trust.

`scripts/derivative_path_study.ts` answers both — `fetch <dataset>` then
`score <dataset>`, recall AND routes-per-control-locus, with the in-CIGAR arm as
a second scoring mode. The corpus is gitignored and **not on this machine**, so
budget the refetch (215 loci of remote range queries against a CRAM and a 116x
BAM; COLO829 also needs the local files under `/home/cdiesh/fusion_demo_build`).
Use D ops only — an N op is a splice, and every RNA-seq read would become a
route.

If the numbers say no, this belongs in
[REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) with them, which is worth as
much as shipping it.
