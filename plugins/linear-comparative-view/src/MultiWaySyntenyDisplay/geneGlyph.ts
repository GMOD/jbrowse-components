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
import {
  featureType,
  getSubfeatures,
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
 * Which of a lane's own genes already draws over this span, if any — the widest
 * overlap where several do.
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
 * Px rather than bp so one rule covers both kinds of lane: the anchor lane's
 * genes and its group spans both come through the view's axis, a mate lane's
 * both come through its frame, and neither pair is comparable in bp with the
 * other.
 */
export function coveringGene(annotated: Span[], span: Span) {
  const lo = Math.min(span[0], span[1])
  const hi = Math.max(span[0], span[1])
  let best: { index: number; overlap: number } | undefined
  for (const [index, a] of annotated.entries()) {
    const alo = Math.min(a[0], a[1])
    const ahi = Math.max(a[0], a[1])
    // the same test as before, kept as a predicate so a box the gene merely
    // abuts is still drawn — reading the width only to arbitrate between two
    // genes over one placement
    if (doesIntersect2(alo, ahi, lo, hi)) {
      const overlap = Math.min(ahi, hi) - Math.max(alo, lo)
      if (best === undefined || overlap > best.overlap) {
        best = { index, overlap }
      }
    }
  }
  return best
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

/**
 * A gene's drawable shape, merged across its transcripts: the CDS full height
 * and the untranslated remainder thin.
 *
 * Merging across transcripts is this display's own operation — the feature
 * track always draws one row per transcript and has nothing to reuse here (its
 * container glyph emits no primitives of its own). What IS taken from it is
 * every leaf rule: `isCDS`/`isExon` match case-insensitively, because a
 * lowercase `cds` is ordinary in real files and matching one case-sensitively
 * derives UTRs from only some exons; `isUTR` reads the three spellings a GFF3
 * uses, so a transcript that names its UTRs rather than its exons draws them
 * instead of coming out as bare CDS; and `mergeSpans` joins abutting pieces,
 * which the CDS and UTR halves of one exon always are.
 */
export function geneGlyphShape(feature: Feature): GeneGlyphShape {
  const exons: GlyphSpan[] = []
  const cds: GlyphSpan[] = []
  const utrs: GlyphSpan[] = []
  const walk = (f: Feature) => {
    for (const sub of getSubfeatures(f)) {
      const span: GlyphSpan = [sub.get('start'), sub.get('end')]
      if (isCDS(sub)) {
        cds.push(span)
      } else if (isUTR(sub)) {
        utrs.push(span)
      } else if (isExon(sub)) {
        exons.push(span)
      }
      walk(sub)
    }
  }
  walk(feature)
  const mergedCds = mergeSpans(cds)
  if (!mergedCds.length) {
    const merged = mergeSpans(exons.length ? exons : utrs)
    return {
      full: merged.length
        ? merged
        : [[feature.get('start'), feature.get('end')]],
      thin: [],
    }
  }
  if (utrs.length) {
    return { full: mergedCds, thin: mergeSpans(utrs) }
  }
  if (exons.length) {
    return {
      full: mergedCds,
      thin: subtractIntervals(mergeSpans(exons), mergedCds),
    }
  }
  // A CDS-only annotation, where the feature's own bounds are the only evidence
  // of coding overhang — `makeUTRs`' rule for the same case, and only at the
  // ends: the gaps BETWEEN the CDS pieces are introns, not untranslated exon
  const start = feature.get('start')
  const end = feature.get('end')
  const codeStart = mergedCds[0]![0]
  const codeEnd = mergedCds.at(-1)![1]
  const thin: [number, number][] = []
  if (start < codeStart) {
    thin.push([start, codeStart])
  }
  if (end > codeEnd) {
    thin.push([codeEnd, end])
  }
  return { full: mergedCds, thin }
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
