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
  // lowercased, the way the feature track admits its own top-level features:
  // a GFF3 spelling `Gene` is otherwise not a gene here and not a container
  // either, so it falls through to the branch meant for transcript-topped
  // annotations
  const typeOf = (f: Feature) => featureType(f).toLowerCase()
  const genes = unique.filter(f => typeOf(f).endsWith('gene'))
  return (
    genes.length ? genes : unique.filter(f => !CONTAINER_TYPES.has(typeOf(f)))
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
 * A lane's drawn gene spans, asking which of them already draws over a
 * placement span — the widest overlap where several do, the first drawn on a
 * tie.
 *
 * A lane draws gene models where it has them and the table's placement boxes
 * where it does not, and the choice is per GROUP rather than per lane. Made per
 * lane it left a ribbon hanging off nothing wherever an annotation named only
 * some of the table's genes — the ordinary case rather than a corner, since the
 * table and the GFF3 are different releases: the demo's blocks file pairs four
 * grape genes and the grape GFF3 names two.
 *
 * It answers WHICH gene rather than whether one exists, so the gene can take
 * the group key the box it replaced would have carried. One predicate decides
 * both — a placement is either a box holding its key, or covered by a gene
 * holding it, never neither. Answering the two questions with two tests is how
 * the hole opened: the better annotated a lane was, the more of the group
 * highlight it lost.
 *
 * Indexed once per lane: asked per placement span, a scan of every gene was
 * tens of millions of interval tests over a gene-dense window of forty lanes.
 * The tree answers the closed overlap, so an abutting gene comes back and the
 * strict test below drops it, keeping a box the gene merely touches drawn.
 */
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
  // the merged CDS across the gene's transcripts, or the merged exons of a
  // non-coding gene, or the whole span of a structureless feature — so a plain
  // BED-backed gene still draws as one box
  full: [number, number][]
  // the untranslated parts of the merged exons, drawn thinner
  thin: [number, number][]
}

function spanOf(f: Feature): GlyphSpan {
  return [f.get('start'), f.get('end')]
}

/**
 * A gene's drawable shape, merged across its transcripts: the CDS full height
 * and the untranslated remainder thin.
 *
 * Merging across transcripts is this display's own operation — the feature
 * track always draws one row per transcript and has nothing to reuse here. What
 * IS the feature track's is every per-transcript rule: which rows are CDS, exon
 * and UTR (`isCDS`/`isExon`/`isUTR`, case-insensitive), and which untranslated
 * stretches a transcript naming no UTRs implies (`impliedUTRs`). A region
 * coding in any transcript reads full.
 */
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
  // the way the gene reads on screen: its strand, mirrored where the lane is.
  // 0 for a strandless feature, which draws no chevrons and no arrowhead
  pxDir: number
  full: Span[]
  thin: Span[]
  // the gaps between the drawn boxes, which is where the connector line goes.
  // The feature track emits one line per gap rather than one across the whole
  // feature, and the chevron pass spaces its marks along each line it is given
  // — so a single span puts chevrons over the exons instead of between them
  introns: Span[]
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
  const fullPx = toPx(full)
  const thinPx = toPx(thin)
  const introns: Span[] = []
  let cursor = left
  for (const [start, end] of mergeSpans(
    [...fullPx, ...thinPx].map(([a, b]): GlyphSpan => [a, b]),
  )) {
    if (start > cursor) {
      introns.push([cursor, start])
    }
    cursor = Math.max(cursor, end)
  }
  if (cursor < right) {
    introns.push([cursor, right])
  }
  return { left, right, pxDir, full: fullPx, thin: thinPx, introns }
}
