---
name: rebuild-the-three-orthofinder-demos-chromsizes
description: rerun the script into `demos/`, then re-render three; raise alpha only uniformly, if at all
metadata:
  area: figures, synteny
  category: ready
---

# Rebuild the three OrthoFinder demos' `chrom.sizes`

`598b8c05ef` changed the build script and nothing else
(`scripts/build_orthofinder_synteny.sh:203-238`), and
`demos/orthofinder_{grasses,vertebrates,wheat}/` have not been touched since
`ffa68a2e84` — so every published figure is still drawn off the largest-30 rows,
and the two spec-side workarounds are still carrying it
(`website/scripts/specs/synteny.ts:2050-2058` and `:2167-2171`).

**The blocks dedupe this entry used to be about is already in the pictures**, so
what follows is a SECOND re-render of the three OrthoFinder figures rather than
the first. `85afc7733f` landed on 08-14 and all five `.blocks` figures were
re-published twice after it — `9ce66dea98` on 08-15 and `572633a842` on 08-20,
both against the local build (`website/scripts/specs/synteny.ts:876-882`), so the
deduped adapter was in force and the ribbon losses have landed.

**Rebuilding is cheap** — one pass over each GFF3 and BED, no OrthoFinder run —
and has to reach `demos/orthofinder_*/` for the figures to see it. The script now
picks the 30 sequences carrying the most genes rather than the longest 30, which
is a different 30 on most of these genomes: 14 of frog's 30 held no ortholog at
all, 18 of urartu's and 12 of tauschii's, while nine real chicken microchromosomes
(16, 25, 30, 31, 35, 36, 38, 39 among them) had fallen off the length cut with
33 and 34 kept. The rows lose their dead tick labels and chicken gets its
chromosomes back. Urartu is the one that stays awkward whatever the rule: its
IGDB assembly spreads ~8.6% of its genes over thousands of contigs, so the
`loc: '1 2 3 4 5 6 7'` in `orthofinder_synteny/wheat_4a_urartu` is still doing
work.

The alpha values were tuned against the old density — 0.15 on wheat and grasses,
0.3 on vertebrates, 0.5 on the two 4A figures. **Raise them only uniformly and
only if the whole band reads too faint**, since the thing that just went away was
a per-band bias and putting ink back per band would restore it.
