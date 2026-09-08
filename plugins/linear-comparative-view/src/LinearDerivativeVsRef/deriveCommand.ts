import { isLocalPathLocation, isUriLocation } from '@jbrowse/core/util'
import { segmentEntryBp, segmentExitBp } from '@jbrowse/plugin-alignments'

import { derivativeName } from './derivativeName.ts'

import type { FileLocation } from '@jbrowse/core/util'
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

// The command is pasted into a shell and every value in it is data: a uri is
// whatever the track config said, a Desktop localPath has spaces, and the SAM
// grammar lets a refName hold `;` or `$`.
function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * The offline command that builds this route as a sequence: the picker ranks
 * what the reads say and draws it, and `derive` is where a consensus, the
 * realignment and the allele-fraction measurement happen. The alignment file
 * is filled in from the track when the adapter names one; the reference FASTA
 * is never known in-app, so it stays a placeholder. The two `<placeholder>`
 * words are the only unquoted ones, since they are what the reader replaces.
 */
export function deriveCommand(
  candidate: DerivativeCandidate,
  alignmentFile: string | undefined,
) {
  const name = shellQuote(derivativeName(candidate))
  return [
    'python3 sv_multihop.py derive',
    `--aln ${alignmentFile === undefined ? '<reads.bam>' : shellQuote(alignmentFile)}`,
    '--ref <reference.fa>',
    `--loci ${shellQuote(deriveLoci(candidate).join(','))}`,
    `--out ${name} --name ${name}`,
  ].join(' \\\n  ')
}

/**
 * What to type after `--aln`: the URL or the path a BAM or CRAM adapter reads,
 * and nothing for an adapter that names neither (a blob dropped into the
 * browser, a SAM served inline).
 */
export function alignmentFileOf(adapter: {
  bamLocation?: FileLocation
  cramLocation?: FileLocation
}) {
  const location = adapter.bamLocation ?? adapter.cramLocation
  return isUriLocation(location)
    ? location.uri
    : isLocalPathLocation(location)
      ? location.localPath
      : undefined
}
