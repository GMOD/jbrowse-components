import { MINIMUM_BLAT_LENGTH } from './blatQuery.ts'

export interface NamedSequence {
  name: string
  seq: string
}

// A hard clip sits outside the soft clip when both are present (`5H20S…`), and
// its bases are not in SEQ, so only the soft clip is there to search
const LEADING_SOFT_CLIP = /^(?:\d+H)?(\d+)S/
const TRAILING_SOFT_CLIP = /(\d+)S(?:\d+H)?$/

/**
 * The soft-clipped ends of a read that are long enough to BLAT. SEQ is stored
 * in reference orientation, so the CIGAR's first op names the bases at the
 * start of SEQ whichever strand the read is on, and left and right are the
 * sides of the pileup the clip is drawn on.
 */
export function softClippedQueries({
  name,
  cigar,
  seq,
}: {
  name: string
  cigar: string
  seq: string
}): NamedSequence[] {
  const left = Number(LEADING_SOFT_CLIP.exec(cigar)?.[1] ?? 0)
  const right = Number(TRAILING_SOFT_CLIP.exec(cigar)?.[1] ?? 0)
  return [
    { name: `${name}_left_clip`, seq: seq.slice(0, left) },
    { name: `${name}_right_clip`, seq: seq.slice(seq.length - right) },
  ].filter(
    clip => clip.seq.length >= MINIMUM_BLAT_LENGTH && left + right < seq.length,
  )
}

// hgBlat names each hit by its record's header, so a launched query arrives in
// the dialog as FASTA whose headers say where it came from
export function toFasta(sequences: NamedSequence[]) {
  return sequences.map(({ name, seq }) => `>${name}\n${seq}`).join('\n')
}
