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
 * The untranslated stretches a coding transcript implies but does not name,
 * decided per side: files often name one UTR and not the other, and a side a
 * UTR row already reaches past the outer CDS bound implies nothing. Where the
 * transcript has exons, each exon's overhang past that bound is untranslated.
 * Where it has none, the transcript's own bounds are the only evidence, and
 * only at the ends: the gaps between CDS pieces are introns. Exons are the
 * authority where they exist, because bounds overhanging the exon union would
 * invent a UTR over untranscribed sequence, which malformed but real GFF does.
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
  const utrs = subs.filter(isUTR)
  const fillLeft = !utrs.some(u => u.get('start') < codeStart)
  const fillRight = !utrs.some(u => u.get('end') > codeEnd)
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
  for (const piece of exons.length > 0 ? exons : [transcript]) {
    const start = piece.get('start')
    const end = piece.get('end')
    if (fillLeft && start < codeStart) {
      push(piece, 'left', start, Math.min(end, codeStart))
    }
    if (fillRight && end > codeEnd) {
      push(piece, 'right', Math.max(start, codeEnd), end)
    }
  }
  return out
}
