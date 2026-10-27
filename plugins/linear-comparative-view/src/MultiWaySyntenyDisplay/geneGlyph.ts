import { IntervalTree, dedupe, doesIntersect2 } from '@jbrowse/core/util'
import { filterExpressionsOf } from '@jbrowse/core/util/jexlFilters'
import {
  featureType,
  getSubfeatures,
  impliedUTRs,
  isCDS,
  isExon,
  isUTR,
  GENE_GLYPH_DEFAULTS,
  mergeSpans,
  representativeIsoform,
} from '@jbrowse/plugin-features'

import type { Span } from './layoutMultiWay.ts'
import type { TrackConfigEntry } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { GlyphSpan, IsoformSettings } from '@jbrowse/plugin-features'

// an NCBI-style GFF3's `region` row would otherwise paint the lane end to end
const CONTAINER_TYPES = new Set(['region', 'chromosome', 'contig', 'scaffold'])

export function laneGeneFeatures(
  features: Feature[],
  isoforms: IsoformSettings,
) {
  const unique = dedupe(features, f => f.id())
  // lowercased as the feature track admits, or a GFF3 `Gene` is no gene here
  const typeOf = (f: Feature) => featureType(f).toLowerCase()
  // a gene may sit under an operon or another grouping row
  const genesIn = (f: Feature): Feature[] =>
    typeOf(f).endsWith('gene') ? [f] : getSubfeatures(f).flatMap(genesIn)
  const genes = unique.flatMap(genesIn)
  return (
    genes.length ? genes : unique.filter(f => !CONTAINER_TYPES.has(typeOf(f)))
  ).map(feature => new LaneGene(feature, isoforms))
}

function strings(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
    ? value
    : fallback
}

function featureDisplayOf(entry?: TrackConfigEntry) {
  const displays = Array.isArray(entry?.displays)
    ? (entry.displays as Record<string, unknown>[])
    : []
  return displays.find(d => d.type === 'LinearBasicDisplay')
}

/**
 * The `jexl:` expressions of the gene track's own `filter`, which it admits
 * features by, so the lane drops what that track drops. Its `geneLike` test
 * stays the track's: the lane draws the genes alone whatever it says. Takes a
 * preprocessed entry.
 */
export function laneGeneFilter(entry?: TrackConfigEntry): string[] {
  return filterExpressionsOf(featureDisplayOf(entry)?.filter)
}

/**
 * What the gene track's own feature display ranks isoforms by, so the lane
 * draws the transcript that track draws. Takes a preprocessed entry, whose
 * `displayDefaults` and retired display types are already folded in.
 */
export function laneIsoformSettings(entry?: TrackConfigEntry): IsoformSettings {
  const display = featureDisplayOf(entry)
  // the raw entry skips the display's lifts, so its v4 names are read too
  const transcripts = (display?.transcripts ?? {}) as Record<string, unknown>
  const field = transcripts.field ?? display?.canonicalTranscriptField
  return {
    transcriptTypes: strings(
      transcripts.types ?? display?.transcriptTypes,
      GENE_GLYPH_DEFAULTS.transcriptTypes,
    ),
    canonicalTranscriptField:
      typeof field === 'string'
        ? field
        : GENE_GLYPH_DEFAULTS.canonicalTranscriptField,
    canonicalTranscriptTags: strings(
      transcripts.sort ?? display?.canonicalTranscriptTags,
      GENE_GLYPH_DEFAULTS.canonicalTranscriptTags,
    ),
  }
}

const DEFAULT_ISOFORM_SETTINGS = laneIsoformSettings()

export class LaneGene {
  private resolved?: GeneGlyphShape

  constructor(
    readonly feature: Feature,
    readonly isoforms: IsoformSettings = DEFAULT_ISOFORM_SETTINGS,
  ) {}

  get shape() {
    this.resolved ??= geneGlyphShape(this.feature, this.isoforms)
    return this.resolved
  }

  /** the transcript the lane draws, which every extent and claim reads */
  get drawn() {
    return this.shape.transcript
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

function subtractIntervals(
  base: readonly (readonly [number, number])[],
  cut: readonly (readonly [number, number])[],
) {
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
  // the representative isoform, or the gene where no child is a transcript
  transcript: Feature
  // merged CDS, else merged exons, else the transcript's whole span
  full: [number, number][]
  thin: [number, number][]
}

function spanOf(f: Feature): GlyphSpan {
  return [f.get('start'), f.get('end')]
}

export function geneGlyphShape(
  feature: Feature,
  isoforms: IsoformSettings = DEFAULT_ISOFORM_SETTINGS,
): GeneGlyphShape {
  const transcript = representativeIsoform(feature, isoforms) ?? feature
  const subs = getSubfeatures(transcript)
  const cds = subs.filter(isCDS).map(spanOf)
  if (cds.length) {
    return {
      transcript,
      full: mergeSpans(cds),
      thin: mergeSpans([
        ...subs.filter(isUTR).map(spanOf),
        ...impliedUTRs(transcript, subs).map(
          u => [u.start, u.end] as GlyphSpan,
        ),
      ]),
    }
  }
  const exons = subs.filter(isExon)
  const parts = mergeSpans(
    (exons.length ? exons : subs.filter(isUTR)).map(spanOf),
  )
  return {
    transcript,
    full: parts.length ? parts : [spanOf(transcript)],
    thin: [],
  }
}

export interface GeneGlyphGeometry {
  left: number
  right: number
  // the drawn transcript's strand mirrored where the lane is, 0 for none
  pxDir: number
  // the drawn transcript's extent, one piece per side of each hole in it
  pieces: Span[]
  full: Span[]
  thin: Span[]
  // one line per gap, or the chevron pass spaces its marks over the exons
  introns: Span[]
}

function ascending(px: Span): Span {
  return px[0] < px[1] ? px : [px[1], px[0]]
}

/**
 * Ascending px intervals on the lane; `span` is the drawn transcript's, and
 * `spansOf` cuts at the lane's holes.
 */
export function geneGlyphGeometry(
  gene: LaneGene,
  span: Span,
  spansOf: (start: number, end: number) => Span[],
): GeneGlyphGeometry {
  const [l, r] = span
  const { drawn, feature } = gene
  const strand = drawn.get('strand') ?? feature.get('strand') ?? 0
  const pxDir = strand === 0 ? 0 : l <= r ? strand : -strand
  const [left, right] = l < r ? [l, r] : [r, l]
  const toPx = (intervals: [number, number][]) =>
    intervals.flatMap(([s, e]) => spansOf(s, e).map(ascending))
  const { full, thin } = gene.shape
  const fullPx = toPx(full)
  const thinPx = toPx(thin)
  const pieces = toPx([[drawn.get('start'), drawn.get('end')]])
  const introns = subtractIntervals(pieces, mergeSpans([...fullPx, ...thinPx]))
  return { left, right, pxDir, pieces, full: fullPx, thin: thinPx, introns }
}
