import { IntervalTree, dedupe, doesIntersect2 } from '@jbrowse/core/util'
import {
  featureType,
  getSubfeatures,
  impliedUTRs,
  isCDS,
  isExon,
  isUTR,
  mergeSpans,
} from '@jbrowse/plugin-canvas'

import type { Span } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'
import type { GlyphSpan } from '@jbrowse/plugin-canvas'

// an NCBI-style GFF3's `region` row would otherwise paint the lane end to end
const CONTAINER_TYPES = new Set(['region', 'chromosome', 'contig', 'scaffold'])

export function laneGeneFeatures(features: Feature[]) {
  const unique = dedupe(features, f => f.id())
  // lowercased as the feature track admits, or a GFF3 `Gene` is no gene here
  const typeOf = (f: Feature) => featureType(f).toLowerCase()
  const genes = unique.filter(f => typeOf(f).endsWith('gene'))
  return (
    genes.length ? genes : unique.filter(f => !CONTAINER_TYPES.has(typeOf(f)))
  ).map(feature => new LaneGene(feature))
}

export class LaneGene {
  private resolved?: GeneGlyphShape

  constructor(readonly feature: Feature) {}

  get shape() {
    this.resolved ??= geneGlyphShape(this.feature)
    return this.resolved
  }
}

/** The drawn span with the widest strict overlap, the first on a tie. */
export function annotatedSpans(annotated: Span[]) {
  const tree = new IntervalTree<number>()
  for (const [index, a] of annotated.entries()) {
    tree.insert([a[0], a[1]], index)
  }
  return (span: Span) => {
    const lo = Math.min(span[0], span[1])
    const hi = Math.max(span[0], span[1])
    let best: { index: number; overlap: number } | undefined
    for (const index of tree.search([lo, hi])) {
      const a = annotated[index]!
      const alo = Math.min(a[0], a[1])
      const ahi = Math.max(a[0], a[1])
      if (doesIntersect2(alo, ahi, lo, hi)) {
        const overlap = Math.min(ahi, hi) - Math.max(alo, lo)
        if (
          best === undefined ||
          overlap > best.overlap ||
          (overlap === best.overlap && index < best.index)
        ) {
          best = { index, overlap }
        }
      }
    }
    return best
  }
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
  // merged CDS, else merged exons, else the feature's whole span
  full: [number, number][]
  thin: [number, number][]
}

function spanOf(f: Feature): GlyphSpan {
  return [f.get('start'), f.get('end')]
}

export function geneGlyphShape(feature: Feature): GeneGlyphShape {
  const cds: GlyphSpan[] = []
  const utr: GlyphSpan[] = []
  const nonCoding: GlyphSpan[] = []
  const visit = (f: Feature) => {
    const subs = getSubfeatures(f)
    const ownCds = subs.filter(isCDS).map(spanOf)
    if (ownCds.length) {
      cds.push(...ownCds)
      utr.push(...subs.filter(isUTR).map(spanOf))
      utr.push(...impliedUTRs(f, subs).map(u => [u.start, u.end] as GlyphSpan))
    } else {
      const exons = subs.filter(isExon)
      nonCoding.push(...(exons.length ? exons : subs.filter(isUTR)).map(spanOf))
    }
    for (const sub of subs) {
      visit(sub)
    }
  }
  visit(feature)
  const full = mergeSpans(cds)
  if (!full.length) {
    const merged = mergeSpans(nonCoding)
    return { full: merged.length ? merged : [spanOf(feature)], thin: [] }
  }
  return {
    full,
    thin: subtractIntervals(mergeSpans([...utr, ...nonCoding]), full),
  }
}

export interface GeneGlyphGeometry {
  left: number
  right: number
  // the gene's strand mirrored where the lane is, 0 for a strandless feature
  pxDir: number
  // the gene's own extent, one piece per side of each hole its lane opens in it
  pieces: Span[]
  full: Span[]
  thin: Span[]
  // one line per gap, or the chevron pass spaces its marks over the exons
  introns: Span[]
}

function ascending(px: Span): Span {
  return px[0] < px[1] ? px : [px[1], px[0]]
}

/** Ascending px intervals on the lane; `spansOf` cuts at the lane's holes. */
export function geneGlyphGeometry(
  gene: LaneGene,
  span: Span,
  spansOf: (start: number, end: number) => Span[],
): GeneGlyphGeometry {
  const [l, r] = span
  const { feature } = gene
  const strand = feature.get('strand') ?? 0
  const pxDir = strand === 0 ? 0 : l <= r ? strand : -strand
  const [left, right] = l < r ? [l, r] : [r, l]
  const toPx = (intervals: [number, number][]) =>
    intervals.flatMap(([s, e]) => spansOf(s, e).map(ascending))
  const { full, thin } = gene.shape
  const fullPx = toPx(full)
  const thinPx = toPx(thin)
  const pieces = toPx([[feature.get('start'), feature.get('end')]])
  const inked = mergeSpans(
    [...fullPx, ...thinPx].map(([a, b]): GlyphSpan => [a, b]),
  )
  const introns: Span[] = []
  for (const [lo, hi] of pieces) {
    let cursor = lo
    for (const [start, end] of inked) {
      if (start >= hi) {
        break
      }
      if (start > cursor) {
        introns.push([cursor, start])
      }
      cursor = Math.max(cursor, end)
    }
    if (cursor < hi) {
      introns.push([cursor, hi])
    }
  }
  return { left, right, pxDir, pieces, full: fullPx, thin: thinPx, introns }
}
