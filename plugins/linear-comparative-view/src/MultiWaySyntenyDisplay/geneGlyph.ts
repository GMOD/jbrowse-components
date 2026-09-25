/**
 * A lane's own gene annotation: which features it draws, and where the feature
 * track's merged gene shape lands on the lane's axis.
 *
 * The shape itself is `plugin-canvas`'s `geneGlyphShape`, the same union its
 * `geneGlyphMode: 'merged'` draws a row from — a lane and that mode ask one
 * question, and every constant that drifted between them once (the UTR height
 * fraction, the CDS/exon test, which untranslated stretches a transcript
 * implies) lived in a second copy of it. What stays here is the projection:
 * `geneGlyphGeometry` maps those bp intervals through whatever px map the lane
 * hands it, which no other display has, and which spent its life inside a React
 * component where the chevron walk was unbounded and untested.
 */
import { IntervalTree, dedupe, doesIntersect2 } from '@jbrowse/core/util'
import { featureType, geneGlyphShape, mergeSpans } from '@jbrowse/plugin-canvas'

import type { Span } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'
import type { GeneGlyphShape, GlyphSpan } from '@jbrowse/plugin-canvas'

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
