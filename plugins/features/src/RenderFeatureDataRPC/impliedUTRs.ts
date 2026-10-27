import { mergeSpans } from '../shared/mergeSpans.ts'
import { getSubfeatures, isCDS, isExon, isUTR } from './util.ts'

import type { Span } from '../shared/mergeSpans.ts'
import type { Feature } from '@jbrowse/core/util'

export interface ImpliedUTR {
  start: number
  end: number
  type: 'five_prime_UTR' | 'three_prime_UTR' | 'UTR'
  side: 'left' | 'right'
  // the exon the stretch was cut from, or the transcript itself when its
  // bounds were the only evidence
  source: Feature
}

function utrType(strand: number, left: boolean): ImpliedUTR['type'] {
  if (strand > 0) {
    return left ? 'five_prime_UTR' : 'three_prime_UTR'
  }
  if (strand < 0) {
    return left ? 'three_prime_UTR' : 'five_prime_UTR'
  }
  return 'UTR'
}

/**
 * The untranslated stretches a coding transcript implies but does not name:
 * whatever of each exon lies outside the outer CDS bounds and under no UTR row.
 * Files often name one UTR and not the other, and a GTF's UTR rows leave out
 * the stop codon its CDS rows also leave out, so a side is filled piece by
 * piece rather than all or nothing. Where the transcript has no exons, its own
 * bounds are the only evidence, and only for a side no UTR row touches: the
 * gaps between CDS or UTR pieces may be introns. Exons are the authority where they exist, because
 * bounds overhanging the exon union would invent a UTR over untranscribed
 * sequence, which malformed but real GFF does.
 *
 * The feature track draws these as synthesized subfeatures, the multiway
 * synteny lane draws them thin, and the transcript coordinates count them.
 */
export function impliedUTRs(
  transcript: Feature,
  subs: Feature[] = getSubfeatures(transcript),
): ImpliedUTR[] {
  let codeStart = Infinity
  let codeEnd = -Infinity
  for (const sub of subs) {
    if (isCDS(sub)) {
      codeStart = Math.min(codeStart, sub.get('start'))
      codeEnd = Math.max(codeEnd, sub.get('end'))
    }
  }
  if (codeStart === Infinity) {
    return []
  }
  const named = mergeSpans(
    subs.filter(isUTR).map(u => [u.get('start'), u.get('end')] as const),
  )
  const strand = transcript.get('strand') ?? 0
  const out: ImpliedUTR[] = []
  const fill = (
    source: Feature,
    side: ImpliedUTR['side'],
    start: number,
    end: number,
  ) => {
    const pieces: Span[] = []
    let cursor = start
    for (const [utrStart, utrEnd] of named) {
      if (utrStart >= end) {
        break
      }
      if (utrEnd > cursor) {
        if (utrStart > cursor) {
          pieces.push([cursor, utrStart])
        }
        cursor = utrEnd
      }
    }
    if (cursor < end) {
      pieces.push([cursor, end])
    }
    const [first] = pieces
    const untouched =
      pieces.length === 1 && first![0] === start && first![1] === end
    const kept = source !== transcript || untouched ? pieces : []
    const type = utrType(strand, side === 'left')
    for (const [s, e] of kept) {
      out.push({ start: s, end: e, side, type, source })
    }
  }
  const exons = subs.filter(isExon)
  for (const piece of exons.length > 0 ? exons : [transcript]) {
    const start = piece.get('start')
    const end = piece.get('end')
    if (start < codeStart) {
      fill(piece, 'left', start, Math.min(end, codeStart))
    }
    if (end > codeEnd) {
      fill(piece, 'right', Math.max(start, codeEnd), end)
    }
  }
  return out
}
