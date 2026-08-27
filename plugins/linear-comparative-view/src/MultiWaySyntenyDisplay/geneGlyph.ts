/**
 * A lane's own gene annotation, both halves: which features it draws, what
 * shape each one is in bp, and where that shape lands in px.
 *
 * The two halves are here together because the px side is a projection of the
 * bp side and nothing else — `geneGlyphGeometry` maps the intervals
 * `geneGlyphShape` merged through whatever px map the lane hands it — and
 * because the px half
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
  return (
    genes.length
      ? genes
      : unique.filter(f => {
          const type = f.get('type')
          return type === undefined || !CONTAINER_TYPES.has(type)
        })
  ).map(feature => new LaneGene(feature))
}

/**
 * A fetched gene with its bp shape resolved once. The shape is a pure walk of
 * the feature's subtree and the same at every zoom, while the px projection
 * changes on every one; measured on the tutorial session it was half of each
 * zoom step's cell packing, so it is kept for the feature's lifetime — lazily,
 * since a fetch window is wider than the canvas and most of it never draws.
 */
export class LaneGene {
  private resolved?: GeneGlyphShape

  constructor(readonly feature: Feature) {}

  get shape() {
    this.resolved ??= geneGlyphShape(this.feature)
    return this.resolved
  }
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
export const UTR_HEIGHT_FRACTION = 0.65
export const MIN_ARROW_GLYPH_PX = 4

export interface GeneGlyphGeometry {
  left: number
  right: number
  // the way the gene reads on screen: its strand, mirrored where the lane is.
  // 0 for a strandless feature, which draws no chevrons and no arrowhead
  pxDir: number
  full: Span[]
  thin: Span[]
}

/**
 * One gene as ascending px intervals on its lane: merged CDS full height, the
 * rest of each exon thin, and the direction it reads resolved in px so a
 * flipped lane's genes point the way that lane reads.
 */
export function geneGlyphGeometry(
  gene: LaneGene,
  span: Span,
  spanOf: (start: number, end: number) => Span | undefined,
): GeneGlyphGeometry {
  const [l, r] = span
  const strand = gene.feature.get('strand') ?? 0
  const pxDir = strand === 0 ? 0 : l <= r ? strand : -strand
  const [left, right] = l < r ? [l, r] : [r, l]
  const toPx = (intervals: [number, number][]) =>
    intervals.flatMap(([s, e]) => {
      const px = spanOf(s, e)
      return px === undefined
        ? []
        : [px[0] < px[1] ? px : ([px[1], px[0]] as Span)]
    })
  const { full, thin } = gene.shape
  return { left, right, pxDir, full: toPx(full), thin: toPx(thin) }
}
