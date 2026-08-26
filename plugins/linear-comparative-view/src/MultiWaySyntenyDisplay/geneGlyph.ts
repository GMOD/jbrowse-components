/**
 * A lane's own gene annotation, both halves: which features it draws, what
 * shape each one is in bp, and where that shape lands in px.
 *
 * The two halves are here together because the px side is a projection of the
 * bp side and nothing else — `geneGlyphPx` maps the intervals `geneGlyphShape`
 * merged through whatever px map the lane hands it — and because the px half
 * spent its life inside a React component, where the chevron walk was
 * unbounded and untested. The bp half transfers to a GPU-emitting backend and
 * the px half does not; that is the seam, and it runs through the middle of
 * this file rather than between two.
 */
import { dedupe, doesIntersect2 } from '@jbrowse/core/util'

import type { Span } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

// What a lane draws from a gene track's top-level features. An NCBI-style GFF3
// also carries a `region` row spanning the whole sequence, which would paint
// the lane end to end; prefer the gene-typed features, and fall back to
// everything that is not a whole-sequence container for annotations whose top
// level is transcripts. Deduped first: the anchor lane is fetched over the
// view's static blocks, and a gene straddling a boundary comes back once per
// block it touches.
const CONTAINER_TYPES = new Set(['region', 'chromosome', 'contig', 'scaffold'])

export function laneGeneFeatures(features: Feature[]) {
  const unique = dedupe(features, f => f.id())
  const genes = unique.filter(f => !!f.get('type')?.endsWith('gene'))
  return genes.length
    ? genes
    : unique.filter(f => {
        const type = f.get('type')
        return type === undefined || !CONTAINER_TYPES.has(type)
      })
}

/**
 * Does a lane's own annotation already draw over this span?
 *
 * A lane draws gene models where it has them and the table's placement boxes
 * where it does not, and the choice is per GROUP rather than per lane. Made per
 * lane it left a ribbon hanging off nothing wherever an annotation named only
 * some of the table's genes — the ordinary case rather than a corner, since the
 * table and the GFF3 are different releases: the demo's blocks file pairs four
 * grape genes and the grape GFF3 names two.
 *
 * Px rather than bp so one rule covers both kinds of lane: the anchor lane's
 * genes and its group spans both come through the view's axis, a mate lane's
 * both come through its frame, and neither pair is comparable in bp with the
 * other.
 */
export function isAnnotated(annotated: Span[], span: Span) {
  const lo = Math.min(span[0], span[1])
  const hi = Math.max(span[0], span[1])
  return annotated.some(a =>
    doesIntersect2(Math.min(a[0], a[1]), Math.max(a[0], a[1]), lo, hi),
  )
}

function mergeIntervals(intervals: [number, number][]) {
  intervals.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

function subtractIntervals(base: [number, number][], cut: [number, number][]) {
  const out: [number, number][] = []
  for (const [start, end] of base) {
    let cursor = start
    for (const [cutStart, cutEnd] of cut) {
      if (cutEnd <= cursor || cutStart >= end) {
        continue
      }
      if (cutStart > cursor) {
        out.push([cursor, cutStart])
      }
      cursor = Math.max(cursor, cutEnd)
    }
    if (cursor < end) {
      out.push([cursor, end])
    }
  }
  return out
}

export interface GeneGlyphShape {
  // the merged CDS across the gene's transcripts, or the merged exons of a
  // non-coding gene, or the whole span of a structureless feature — so a plain
  // BED-backed gene still draws as one box
  full: [number, number][]
  // the untranslated parts of the merged exons, drawn thinner
  thin: [number, number][]
}

// A gene's drawable shape, merged across its transcripts: exon and CDS
// intervals collected from the whole subtree, the CDS full-height and the
// exon-minus-CDS remainder as UTR.
export function geneGlyphShape(feature: Feature): GeneGlyphShape {
  const exons: [number, number][] = []
  const cds: [number, number][] = []
  const walk = (f: Feature) => {
    for (const sub of f.get('subfeatures') ?? []) {
      const type = sub.get('type')
      if (type === 'exon') {
        exons.push([sub.get('start'), sub.get('end')])
      } else if (type === 'CDS') {
        cds.push([sub.get('start'), sub.get('end')])
      }
      walk(sub)
    }
  }
  walk(feature)
  const mergedCds = mergeIntervals(cds)
  const mergedExons = exons.length
    ? mergeIntervals(exons)
    : mergedCds.length
      ? mergedCds
      : [[feature.get('start'), feature.get('end')] as [number, number]]
  return exons.length && mergedCds.length
    ? { full: mergedCds, thin: subtractIntervals(mergedExons, mergedCds) }
    : { full: mergedExons, thin: [] }
}

// Gene glyph geometry matching the canvas gene track's: UTRs thinner and
// vertically centered, intron lines carrying direction chevrons, an arrowhead
// past the downstream end.
const UTR_HEIGHT_FRACTION = 0.65
const CHEVRON_SPACING_PX = 10
const MIN_CHEVRON_GAP_PX = 8
const MIN_ARROW_GLYPH_PX = 4

/**
 * Where the direction chevrons sit along a gene's introns, given its drawn
 * blocks LOW TO HIGH in px.
 *
 * Walked over the CANVAS, not over the intron. A lane's frame reaches only the
 * canvas, but the anchor lane runs the view's own axis, which spans the whole
 * displayed region: an intron there is as wide in px as the zoom makes it, so a
 * 50kb intron at 1bp/px is five thousand chevrons in one path string, every one
 * of them off screen, rebuilt on every pan. The walk keeps its phase — the
 * positions are the same ones the unclipped walk would have produced — and
 * starts at the first that could be seen.
 */
export function chevronXs(left: number, blocks: Span[], canvasWidth: number) {
  const xs: number[] = []
  let prevEnd = left
  for (const [blockStart, blockEnd] of blocks) {
    if (blockStart - prevEnd >= MIN_CHEVRON_GAP_PX) {
      const to = Math.min(blockStart, canvasWidth + CHEVRON_SPACING_PX)
      const skipped = Math.max(
        0,
        Math.floor((-CHEVRON_SPACING_PX - prevEnd) / CHEVRON_SPACING_PX),
      )
      for (
        let x = prevEnd + CHEVRON_SPACING_PX * (skipped + 0.5);
        x <= to - CHEVRON_SPACING_PX / 2;
        x += CHEVRON_SPACING_PX
      ) {
        xs.push(x)
      }
    }
    prevEnd = Math.max(prevEnd, blockEnd)
  }
  return xs
}

// A chevron, or the arrowhead, as an svg path: two strokes meeting at `x`.
function chevronPath(x: number, mid: number, size: number, dir: number) {
  return `M ${x - size * dir} ${mid - size} L ${x} ${mid} L ${x - size * dir} ${mid + size}`
}

export interface GeneGlyphPx {
  /** the gene's whole drawn extent, low to high */
  left: number
  right: number
  /** the intron midline's y, and the CDS box's own top */
  mid: number
  /** merged CDS boxes, and the untranslated remainder drawn thinner */
  full: Span[]
  thin: Span[]
  utrY: number
  utrHeight: number
  /** the direction marks, already `d` strings, or '' where there are none */
  chevrons: string
  arrow: string
}

/**
 * Everything the SVG of one gene glyph draws, as numbers.
 *
 * `spanOf` is whatever px map the lane uses — the view's axis on the anchor
 * lane, the lane's own frame below it — and it CLIPS, so an interval the lane
 * cannot reach comes back undefined and is left out rather than extrapolated.
 * `span` is the whole gene through that same map, which the caller already has
 * (it culls and tests annotation coverage with it).
 *
 * Direction is resolved in PIXEL space, so a gene on a flipped lane points the
 * way it reads there rather than the way its strand column says.
 */
export function geneGlyphPx(
  feature: Feature,
  span: Span,
  spanOf: (start: number, end: number) => Span | undefined,
  {
    y,
    glyphHeight,
    canvasWidth,
  }: {
    y: number
    glyphHeight: number
    canvasWidth: number
  },
): GeneGlyphPx {
  const [l, r] = span
  const strand = feature.get('strand') ?? 0
  const pxDir = strand === 0 ? 0 : l <= r ? strand : -strand
  const [left, right] = l < r ? [l, r] : [r, l]
  const mid = y + glyphHeight / 2

  const ascending = (start: number, end: number): Span | undefined => {
    const px = spanOf(start, end)
    return px === undefined ? undefined : px[0] < px[1] ? px : [px[1], px[0]]
  }
  const toPx = (intervals: [number, number][]) =>
    intervals.flatMap(([s, e]) => {
      const px = ascending(s, e)
      return px ? [px] : []
    })

  const { full, thin } = geneGlyphShape(feature)
  const fullPx = toPx(full)
  const thinPx = toPx(thin)

  const chevronSize = Math.min(2.5, glyphHeight / 3)
  const arrowSize = Math.min(3.5, glyphHeight / 2)
  return {
    left,
    right,
    mid,
    full: fullPx,
    thin: thinPx,
    utrY: y + ((1 - UTR_HEIGHT_FRACTION) / 2) * glyphHeight,
    utrHeight: glyphHeight * UTR_HEIGHT_FRACTION,
    chevrons:
      pxDir === 0
        ? ''
        : chevronXs(
            left,
            [...fullPx, ...thinPx].sort((a, b) => a[0] - b[0]),
            canvasWidth,
          )
            .map(x => chevronPath(x, mid, chevronSize, pxDir))
            .join(''),
    arrow:
      pxDir !== 0 && right - left >= MIN_ARROW_GLYPH_PX
        ? chevronPath(
            (pxDir === 1 ? right : left) + arrowSize * pxDir,
            mid,
            arrowSize,
            pxDir,
          )
        : '',
  }
}
