---
name: multiway-orientation-few-groups
description: "hs1 draws [rev] under hg38 at 17q21.31 with 1.5 Mb of forward chain and 44 bp reverse: a fresh lane with three shared groups takes the all-pairs order vote, where one inverted record outvotes two collinear runs. The fix to weigh is taking the anchor-order fallback below MIN_SHARED_TO_SWITCH on a fresh decision, measured on the grape walk and the 17p table."
---

Seen 2026-09-28 while shooting the hosted hg38 star at
`chr17:45,300,000-46,800,000` (MAPT to NSF) with the T2T human lanes. The hs1
lane draws `[rev]`. The chain there is one forward record over the whole
chromosome plus one inverted record, hg38 46,558,730-47,530,617 onto hs1
39.1-46.36 Mb, whose clipped runs land inside the lane's fit.

`multiwayOrientation17p.probe.ts` pointed at that window (MATES = hs1, the two
H9 haplotypes, HG002 maternal, NA24631 maternal):

| lane | drawn | fallback | shared | all-pairs bwd | + bp | - bp |
| --- | --- | --- | --- | --- | --- | --- |
| hs1 | [rev] | forward | 3 | 0.657 | 1,500,023 | 44 |
| H9 hap2 | forward | forward | 14 | 0.196 | 716,801 | 807,139 |

`orientationVote` pairs every shared run against every other, weighed by the
product of the groups' anchor bp, so with three shared groups the two pairs an
inverted record makes against the collinear runs outweigh the one pair those
runs make with each other. `decideOrientation` takes that vote on a fresh
decision whatever `vote.shared` is; `MIN_SHARED_TO_SWITCH` (5) guards only a
switch away from an incumbent.

The fix to weigh: a fresh decision with fewer than `MIN_SHARED_TO_SWITCH`
shared groups takes `fitted`, the anchor-order fallback, which is forward
here. It moves no lane in the 17p table (gorGor6 already falls back, the rest
share 6 or more) and needs the grape stability walk re-run
(`multiwayLaneStability` measurement) before landing, since gene-table lanes
sharing three or four groups would fall back where they now vote.

Until then the human figure on `genomes_synteny.md` leaves hs1 out.
