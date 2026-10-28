import type { ContigColumns } from '../data_adapters/BaseAdapter/util.ts'

/**
 * A file made against one genome build and loaded against another with the
 * same contig names (hg38 data on CHM13, say) passes the name check, and a
 * CRAM then decodes its reads against the wrong sequence with no sign of it.
 * The contig lengths the file's header states give that away at no cost.
 *
 * Only a build-wide disagreement is a verdict: most of the shared bases sit on
 * contigs whose lengths differ. A few differing contigs are ordinary — b37 and
 * hg19 agree on every chromosome but chrM — and belong in
 * `RefNameInfoDialog`, which lists each one.
 *
 * Two builds' versions of a chromosome differ by a few percent. A contig under
 * half the other side's length is a slice of it instead (a demo FASTA cut from
 * a chromosome, with the BAM keeping its full `@SQ`), and positions in a slice
 * starting at 0 are right, so a slice is left out of the comparison.
 */

export interface ContigLengthDifference {
  /** the assembly's canonical name */
  refName: string
  fileLength: number
  assemblyLength: number
}

export interface ContigLengthMismatch {
  assemblyName: string
  /** the shared contigs whose lengths differ, longest first, the first few */
  differences: ContigLengthDifference[]
}

const SAMPLE_SIZE = 2

/**
 * Each region's length by canonical name. A region starting past 0 is a slice,
 * whose end is no contig length.
 */
export function assemblyContigLengths(
  regions: readonly { refName: string; start: number; end: number }[],
) {
  return new Map(
    regions.filter(r => r.start === 0).map(r => [r.refName, r.end] as const),
  )
}

/** the file's contigs that resolve to an assembly contig, with both lengths */
export function sharedContigLengths({
  contigs: { refNames, lengths },
  assemblyLengths,
  getCanonicalRefName,
}: {
  contigs: ContigColumns
  assemblyLengths: ReadonlyMap<string, number>
  getCanonicalRefName: (refName: string) => string | undefined
}) {
  return refNames.flatMap((refName, i) => {
    const fileLength = lengths[i]
    const canonical = getCanonicalRefName(refName)
    const assemblyLength =
      canonical === undefined ? undefined : assemblyLengths.get(canonical)
    return fileLength === undefined || assemblyLength === undefined
      ? []
      : [{ refName: canonical!, fileLength, assemblyLength }]
  })
}

export function detectContigLengthMismatch({
  assemblyName,
  ...rest
}: {
  assemblyName: string
  contigs: ContigColumns
  assemblyLengths: ReadonlyMap<string, number>
  getCanonicalRefName: (refName: string) => string | undefined
}): ContigLengthMismatch | undefined {
  const shared = sharedContigLengths(rest).filter(
    c =>
      Math.max(c.fileLength, c.assemblyLength) <
      2 * Math.min(c.fileLength, c.assemblyLength),
  )
  const differences = shared
    .filter(c => c.fileLength !== c.assemblyLength)
    .sort((a, b) => b.assemblyLength - a.assemblyLength)
  const bases = (list: ContigLengthDifference[]) =>
    list.reduce((total, c) => total + c.assemblyLength, 0)
  return bases(differences) * 2 > bases(shared)
    ? {
        assemblyName,
        differences: differences.slice(0, SAMPLE_SIZE),
      }
    : undefined
}

function bp(n: number) {
  return `${n.toLocaleString('en-US')} bp`
}

export function contigLengthMismatchMessage({
  assemblyName,
  differences,
}: ContigLengthMismatch) {
  const examples = differences
    .map(
      d =>
        `${d.refName} is ${bp(d.fileLength)} in the file, ${bp(d.assemblyLength)} in the assembly`,
    )
    .join('; ')
  return (
    `This track's file looks to be from a different genome build than assembly "${assemblyName}": ` +
    `most of the sequence they share is on reference sequences of different lengths (${examples}). ` +
    "Its positions refer to the other build's sequence. " +
    'Load it against the assembly it was made with.'
  )
}
