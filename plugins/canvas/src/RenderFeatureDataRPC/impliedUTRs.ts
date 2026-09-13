import { getSubfeatures, isCDS, isExon, isUTR } from './util.ts'

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
 * The untranslated stretches a coding transcript implies but does not name.
 * A transcript naming any UTR row implies none. Where it has exons, each
 * exon's overhang past the outer CDS bounds is untranslated. Where it has
 * none, the transcript's own bounds are the only evidence, and only at the
 * ends: the gaps between CDS pieces are introns. Exons are the authority where
 * they exist, because bounds overhanging the exon union would invent a UTR
 * over untranscribed sequence, which malformed but real GFF does.
 *
 * The feature track draws these as synthesized subfeatures and the multiway
 * synteny lane draws them thin; both read this one rule.
 */
export function impliedUTRs(
  transcript: Feature,
  subs: Feature[] = getSubfeatures(transcript),
): ImpliedUTR[] {
  if (subs.some(isUTR)) {
    return []
  }
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
  const strand = transcript.get('strand') ?? 0
  const out: ImpliedUTR[] = []
  const push = (
    source: Feature,
    side: ImpliedUTR['side'],
    start: number,
    end: number,
  ) => {
    out.push({
      start,
      end,
      side,
      type: utrType(strand, side === 'left'),
      source,
    })
  }
  const exons = subs.filter(isExon)
  if (exons.length === 0) {
    const start = transcript.get('start')
    const end = transcript.get('end')
    if (start < codeStart) {
      push(transcript, 'left', start, codeStart)
    }
    if (end > codeEnd) {
      push(transcript, 'right', codeEnd, end)
    }
    return out
  }
  for (const exon of exons) {
    const start = exon.get('start')
    const end = exon.get('end')
    if (start < codeStart) {
      push(exon, 'left', start, Math.min(end, codeStart))
    }
    if (end > codeEnd) {
      push(exon, 'right', Math.max(start, codeEnd), end)
    }
  }
  return out
}
