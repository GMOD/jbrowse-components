import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface FollowWindow {
  refName: string
  start: number
  end: number
}

// A contig showing less than a pixel is not part of what the reader is looking
// at, and a whole-genome view of a fragmented assembly has thousands of them.
const MIN_VISIBLE_PX = 1

// ...and one with less than this share of the WIDEST contig's pixels is the tail
// of a neighbour being scrolled off rather than half of a comparison — see
// `followAnchorWindows` for what turns on it. Relative to the widest rather than
// to the panel, because a two-contig assembly is legitimately lopsided: volvox
// is 89% ctgA, and a panel showing all of both is an overview, not a straddle.
const MIN_SHARE_OF_WIDEST = 0.05

// Enough for any chromosome-scale assembly, and a bound on what a scaffold-level
// one can cost: the widest few dozen contigs are most of the screen, and the
// answer is an INTERVAL spanning them, so a contig dropped here almost always
// falls between two that were kept.
const MAX_WINDOWS = 64

function measure(blocks: ContentBlock[]) {
  const byRefName = new Map<string, FollowWindow & { widthPx: number }>()
  for (const b of blocks) {
    const prev = byRefName.get(b.refName)
    if (prev) {
      prev.widthPx += b.widthPx
      prev.start = Math.min(prev.start, b.start)
      prev.end = Math.max(prev.end, b.end)
    } else {
      byRefName.set(b.refName, {
        refName: b.refName,
        widthPx: b.widthPx,
        start: b.start,
        end: b.end,
      })
    }
  }
  return [...byRefName.values()]
}

/**
 * The windows a follow reads off the anchor panel: its visible span on each
 * refName it is showing, widest by SCREEN px first.
 *
 * Per refName because an alignment lives on one contig pair, and the union of
 * that refName's blocks so a contig split by a padding block still yields the
 * whole visible stretch.
 *
 * A SLIVER BESIDE A FULL PANEL IS NOT ONE OF THEM, which is what keeps a
 * boundary straddle out of the multi-contig rung. The COUNT of these decides
 * that rung, and its answer is an interval spanning everything the windows map
 * to — so on the sub-pixel floor alone, a 2px tail of the contig being scrolled
 * off counted the same as the 798px one filling the panel, and where the two
 * assemblies order their contigs differently that tail's mate sits a genome
 * away: the moving row zoomed out to span both, mid-drag, over a sliver the
 * reader had stopped looking at. Above the relative floor the panel really is
 * showing several contigs and the union is the honest answer; below it the
 * widest contig alone is, exactly as it was before the rung existed.
 */
export function followAnchorWindows(blocks: ContentBlock[]): FollowWindow[] {
  const sorted = measure(blocks)
    .filter(w => w.widthPx >= MIN_VISIBLE_PX)
    .sort((a, b) => b.widthPx - a.widthPx)
  const widest = sorted[0]
  return widest
    ? sorted
        .filter(w => w.widthPx >= widest.widthPx * MIN_SHARE_OF_WIDEST)
        .slice(0, MAX_WINDOWS)
        // rebuilt so `widthPx` does not ride along undeclared
        .map(({ refName, start, end }) => ({ refName, start, end }))
    : []
}

/**
 * The windows the level BEYOND this one reads off a row this pass has just
 * placed: the spans it was placed on, unioned per refName.
 *
 * A row placed across an interval of its own layout shows every contig between
 * the leftmost mapped one and the rightmost — chr2..chr8 for a fusion answering
 * on chr1 and chr9 — and a row lays its regions end to end, so that filler is
 * not something the follow can decline to show. What it can decline to do is
 * READ IT BACK AS INPUT. Off the row's blocks a filler chromosome is
 * indistinguishable from a mapped one, clears `MIN_SHARE_OF_WIDEST` comfortably
 * at chromosome sizes, and so earns its own vote and its own span at the next
 * level — whose union then reaches wherever THAT maps, pulling in more filler
 * still. It compounds per level: a two-contig answer on a three-row stack was
 * enough to leave the far row on the whole genome.
 *
 * PER REFNAME because `followWindowsMapping` slots blocks by refName id and two
 * windows sharing one collide on that slot, so the later takes every block and
 * the earlier answers nothing. Several synteny tracks on a level produce that
 * routinely — each contributes its own span per contig.
 *
 * NO SHARE FLOOR, unlike the blocks form. A small span is a small alignment,
 * which is a fact about the data; a 2px contig is a neighbour being scrolled
 * off, which is a fact about the drag. A span on a contig the moving row cannot
 * show needs no filtering either: the synteny fetch keeps a block only when
 * both ends are in view, so the next level has nothing loaded under such a
 * window and it maps to nothing.
 */
export function followPlacedWindows(spans: FollowWindow[]): FollowWindow[] {
  const byRefName = new Map<string, FollowWindow>()
  for (const { refName, start, end } of spans) {
    const prev = byRefName.get(refName)
    if (prev) {
      prev.start = Math.min(prev.start, start)
      prev.end = Math.max(prev.end, end)
    } else {
      byRefName.set(refName, { refName, start, end })
    }
  }
  return [...byRefName.values()]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, MAX_WINDOWS)
}

/**
 * The one window a single-contig follow reads off the anchor panel: the widest
 * by SCREEN px, which is what the eye picks as "where the view is" and stays
 * true across contigs differing in size by orders of magnitude.
 *
 * The right operand for everything that maps a window through ONE alignment. A
 * pass placing a row from a whole-genome overview wants `followAnchorWindows`
 * instead — this drops every contig but one, which at that zoom is most of the
 * screen.
 */
export function followAnchorWindow(blocks: ContentBlock[]) {
  return followAnchorWindows(blocks)[0]
}
