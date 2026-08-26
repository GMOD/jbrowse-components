import { geneGlyphShape } from './layoutMultiWay.ts'

import type { Span } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

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
export function chevronPath(x: number, mid: number, size: number, dir: number) {
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
