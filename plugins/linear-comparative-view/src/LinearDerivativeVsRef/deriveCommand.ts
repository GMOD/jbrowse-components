import { segmentEntryBp, segmentExitBp } from '@jbrowse/plugin-alignments'

import { derivativeName } from './derivativeName.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

/**
 * The `--loci` list `sv_multihop.py derive` wants for a picked route: both
 * sides of every junction, in path order. `derive` tests each locus for
 * containment in some aligned segment of a read, so a read has to touch every
 * one of these to count as spanning the whole route. Read off
 * `observedSegments`: the drawn outer segments carry a context flank, and a
 * flank is not a junction.
 */
export function deriveLoci(candidate: DerivativeCandidate) {
  const segs = candidate.observedSegments
  const loci: string[] = []
  segs.forEach((seg, idx) => {
    if (idx > 0) {
      loci.push(`${seg.refName}:${segmentEntryBp(seg)}`)
    }
    if (idx < segs.length - 1) {
      loci.push(`${seg.refName}:${segmentExitBp(seg)}`)
    }
  })
  return loci.filter((locus, idx) => loci.indexOf(locus) === idx)
}

/**
 * The offline command that builds this route as a sequence: the picker ranks
 * what the reads say and draws it, and `derive` is where a consensus, the
 * realignment and the allele-fraction measurement happen. The alignment file
 * is filled in from the track when the adapter names one; the reference FASTA
 * is never known in-app, so it stays a placeholder.
 */
export function deriveCommand(
  candidate: DerivativeCandidate,
  alignmentUri: string | undefined,
) {
  const name = derivativeName(candidate)
  return [
    'python3 sv_multihop.py derive',
    `--aln ${alignmentUri ?? '<reads.bam>'}`,
    '--ref <reference.fa>',
    `--loci ${deriveLoci(candidate).join(',')}`,
    `--out ${name} --name ${name}`,
  ].join(' \\\n  ')
}

/**
 * The file a BAM or CRAM adapter reads, or nothing for an adapter that names
 * none (a SAM served inline, a synthetic track in a test).
 */
export function alignmentUriOf(adapter: unknown) {
  const conf = adapter as {
    bamLocation?: { uri?: string }
    cramLocation?: { uri?: string }
  }
  return conf.bamLocation?.uri ?? conf.cramLocation?.uri
}
