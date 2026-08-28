Why there are two classes

They landed two days apart and the second one exists because the first was empty in the case it mattered most (867e8de7e8, 2026-08-23):

▎ Stacked whole assemblies make that set empty by construction — every contig IS displayed — while overdrawPx goes on culling every ribbon whose mate has scrolled out of the band... Reported from demos/grape_peach_cacao with all three rows on whole assemblies and "Mark them" on: the strip drew nothing. 125 of 126 instances culled, tally 0, marks 0.

Class A is a fetch-time question the worker can answer (v2RefNames.has(mate.refName)). Class B can't move into the fetch — the facing row pans a whole syntenyPanBufferPx without refetching, so a mark decided when the data landed would sit next to the ribbon it claims doesn't exist. So it's a per-frame test instead, deliberately the same comparison isRibbonCulled makes, restated in the target row's cumBp.

Where I think that goes wrong — and it's your case

Class B has no notion of distance. It fires exactly at the ribbon cull boundary, which is overdrawPx = 1000 px by default. Meanwhile the fetch buffer is syntenyPanBufferPx = 2000 px. So there is a 1000 px annulus of alignments that are fetched, are the ordinary continuation of the block you're looking at, and get marked as "off-screen mates" — with no way to tell them from a mate on a chromosome you never stacked.

At your zoom (331 Kbp over ~1450 px ≈ 228 bp/px) the band is human chr17 ≈ 42.71–43.49 Mb. Anything past that is marked. The rule was designed for "the two rows are over completely different chromosomes"; it also fires on "there's more of this block just past the edge", and those are the same test.

Two things follow that I'd call defects regardless of what your data turns out to be:

- The class B mark should be conditioned on how far, not on the cull boundary. A mate one screen past the edge is not the same fact as a mate on another chromosome.
- Nothing in the mark, label, or tooltip distinguishes the classes, even though the click path already does (mateFlightAllowed flies for B, navToLocString replaces regions for A).

What I could not settle from the code

The test itself is an overlap test (drawOffscreenMates.ts:522): mateEnd >= band.lo && mateStart <= band.hi. An alignment that overlaps the human band is not marked, however large it is. So if you're right that it overlaps, the mate coordinates reaching that test are wrong, and the only thing that moves them is clipLargeBlockToWindow — which re-anchors a block to the query window and re-derives its mate coords from the CIGAR, but only above CLIP_SPAN_RATIO × window ≈ 5 Mb on the chimp axis. If your PAF has blocks that big, that's the suspect. If it doesn't, the marks are real distant chr17 hits (the panel is showing BRCA1 and BRCA1P1, so segdup paralogs are exactly what's there) and the problem is the design point above.

Paste this in the console on the open view — it prints which lane fired and the actual human coordinates of every marked alignment:

const v = session.views.find(x => x.type === 'LinearSyntenyView')
const lvl = v.levels[0], d = lvl.linearSyntenyDisplays[0]
const above = v.views[lvl.level], below = v.views[lvl.level + 1]
const band = {
  lo: (below.offsetPx - v.overdrawPx) * below.bpPerPx,
  hi: (below.offsetPx + v.width + v.overdrawPx) * below.bpPerPx,
}
console.log('class A (contig not displayed):', d.offscreenMateTally)
const q = d.culledRibbonMates.onQueryAxis, marked = []
for (let i = 0; i < q.starts.length; i++) {
  const x1 = q.starts[i] / above.bpPerPx - above.offsetPx
  const x2 = q.ends[i] / above.bpPerPx - above.offsetPx
  if (x2 < 0 || x1 > v.width) continue
  if (q.mateAxis.ends[i] >= band.lo && q.mateAxis.starts[i] <= band.hi) continue
  marked.push({
    x: [Math.round(x1), Math.round(x2)],
    mateRef: q.mateRefNameDict[q.mateRefNameIds[i]],
    mateBp: [q.mateStarts[i], q.mateEnds[i]],
    len: q.lengths[i],
  })
}
console.log('class B marked', marked.length, 'of', q.starts.length, marked)
console.log('human band cumBp', band, 'mate extent', q.mateAxis.lo, q.mateAxis.hi)

mateBp is the untrimmed adapter coordinate on chr17. If those come back near 42.9–43.2 Mb, it's a coordinate bug and I'll chase the clip path. If they come back at 38 Mb or 45 Mb, the marks are honest and the fix is the threshold.
