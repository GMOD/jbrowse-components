import type { Contig } from '../data_adapters/BaseAdapter/util.ts'

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
  /** how many shared contigs differ, of how many with a length on both sides */
  differing: number
  compared: number
}

const SAMPLE_SIZE = 3

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
  contigs,
  assemblyLengths,
  getCanonicalRefName,
}: {
  contigs: readonly Contig[]
  assemblyLengths: ReadonlyMap<string, number>
  getCanonicalRefName: (refName: string) => string | undefined
}) {
  return contigs.flatMap(({ refName, length: fileLength }) => {
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
  contigs: readonly Contig[]
  assemblyLengths: ReadonlyMap<string, number>
  getCanonicalRefName: (refName: string) => string | undefined
}): ContigLengthMismatch | undefined {
  const shared = sharedContigLengths(rest)
  const differences = shared
    .filter(c => c.fileLength !== c.assemblyLength)
    .sort((a, b) => b.assemblyLength - a.assemblyLength)
  const bases = (list: ContigLengthDifference[]) =>
    list.reduce((total, c) => total + c.assemblyLength, 0)
  return bases(differences) * 2 > bases(shared)
    ? {
        assemblyName,
        differences: differences.slice(0, SAMPLE_SIZE),
        differing: differences.length,
        compared: shared.length,
      }
    : undefined
}

function bp(n: number) {
  return `${n.toLocaleString('en-US')} bp`
}

export function contigLengthMismatchMessage({
  assemblyName,
  differences,
  differing,
  compared,
}: ContigLengthMismatch) {
  const examples = differences
    .map(
      d =>
        `${d.refName} is ${bp(d.fileLength)} in the file, ${bp(d.assemblyLength)} in the assembly`,
    )
    .join('; ')
  return (
    `This track's file looks to be from a different genome build than assembly "${assemblyName}": ` +
    `${differing} of the ${compared} reference sequences they share differ in length (${examples}). ` +
    'Its data will be drawn against the wrong sequence. ' +
    'Load it against the assembly it was made with.'
  )
}
