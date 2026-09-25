import { mergeSpans } from '../shared/mergeSpans.ts'
import { impliedUTRs } from './impliedUTRs.ts'
import { getSubfeatures, isCDS, isExon, isUTR } from './util.ts'

import type { Span } from '../shared/mergeSpans.ts'
import type { Feature } from '@jbrowse/core/util'

export interface GeneGlyphShape {
  // the merged CDS across the gene's transcripts, or the merged exons of a
  // non-coding gene, or the whole span of a structureless feature — so a plain
  // BED-backed gene still draws as one box
  full: Span[]
  // the untranslated parts of the merged exons, drawn thinner
  thin: Span[]
}

function subtractIntervals(base: readonly Span[], cut: readonly Span[]) {
  const out: Span[] = []
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

function spanOf(f: Feature): Span {
  return [f.get('start'), f.get('end')]
}

/**
 * Whether a feature's subtree carries anything a merge can draw FROM. A
 * container whose descendants are none of these — a `supercontig` of leaf
 * genes, reachable through the `containerTypes` slot — has no shape to union,
 * and merging it paints one bar from end to end over children it should be
 * stacking.
 */
export function hasGeneParts(feature: Feature): boolean {
  return getSubfeatures(feature).some(
    sub => isCDS(sub) || isExon(sub) || isUTR(sub) || hasGeneParts(sub),
  )
}

/**
 * A gene's drawable shape merged across its transcripts: the CDS full height
 * and the untranslated remainder thin. A region coding in any transcript reads
 * full.
 *
 * Every per-transcript rule is the ordinary gene glyph's — which rows are CDS,
 * exon and UTR, and which untranslated stretches a transcript naming no UTRs
 * implies (`impliedUTRs`). Only the union across transcripts is new, and it is
 * the whole of what `geneGlyphMode: 'merged'` draws and what a multi-way
 * synteny lane projects onto its own axis.
 *
 * `impliedUTRs` is the display's slot of the same name, which the stacked
 * glyph reads through `getSubparts`; the lane, having no such slot, takes the
 * default. What it does NOT read is `subParts`: that slot names the file's own
 * row types, and a merged span is a union rather than a row.
 */
export function geneGlyphShape(
  feature: Feature,
  { impliedUTRs: implied = true }: { impliedUTRs?: boolean } = {},
): GeneGlyphShape {
  const cds: Span[] = []
  const utr: Span[] = []
  const nonCoding: Span[] = []
  const visit = (f: Feature) => {
    const subs = getSubfeatures(f)
    const ownCds = subs.filter(isCDS).map(spanOf)
    if (ownCds.length) {
      cds.push(...ownCds)
      utr.push(...subs.filter(isUTR).map(spanOf))
      if (implied) {
        utr.push(...impliedUTRs(f, subs).map(u => [u.start, u.end] as Span))
      }
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
