/**
 * Every conventional spelling of an index file, for the docs that describe this
 * behavior — the prose form of the list {@link indexCandidateNames} builds.
 */
export const indexSpellings = [
  {
    name: '`<file>.tbi`, `<file>.bai`, `<file>.crai`',
    writtenBy: 'samtools, tabix',
  },
  {
    name: '`<file>.csi`',
    writtenBy: 'htslib, for a reference over 512 Mb and on request at any size',
  },
  {
    name: '`reads.bai` beside `reads.bam`',
    writtenBy: 'Picard, GATK',
  },
]

// Per-suffix because the alternatives are: a `.crai` has no CSI form, and
// stripping the extension off `calls.vcf.gz` would name `calls.vcf.tbi`, which
// nothing writes. A `.fai`/`.gzi` has neither and so is absent here.
const ALTERNATE_SPELLINGS: Record<
  string,
  { csi?: boolean; stripped?: boolean }
> = {
  '.bai': { csi: true, stripped: true },
  '.crai': { stripped: true },
  '.tbi': { csi: true },
}

/**
 * The names a sidecar with this suffix might be under beside `location`, best
 * guess first — the conventional one, then htslib's `.csi`, then the stripped
 * form Picard and GATK write.
 *
 * The guard on the stripped spelling is load-bearing: `replace` hands back the
 * subject unchanged when the pattern does not match, so a name carrying no
 * extension at all would offer the data file as its own index.
 */
export function sidecarCandidateNames(
  location: string,
  suffix: string,
): [string, ...string[]] {
  const { csi, stripped } = ALTERNATE_SPELLINGS[suffix] ?? {}
  const strippedName = location.replace(/\.[^./\\]+$/, suffix)
  return [
    `${location}${suffix}`,
    ...(csi ? [`${location}.csi`] : []),
    ...(stripped && strippedName !== location ? [strippedName] : []),
  ]
}

// The tabix family is spelled by its compression, not its content: a `.gz` here
// is a bgzipped VCF/GFF/BED/SAM, all of which index the same two ways, and
// `.bgz` is the same file under the name htslib's own tools give it.
const INDEX_SUFFIXES: [RegExp, string][] = [
  [/\.bam$/i, '.bai'],
  [/\.cram$/i, '.crai'],
  [/\.b?gz$/i, '.tbi'],
]

/**
 * The index filenames worth looking for beside `fileName`, best guess first.
 *
 * One data file has several names its index might carry, and picking only the
 * first left everyone else with a missing-file error naming a path they never
 * wrote. Empty for a file type that carries no sibling index (BigWig, BigBed,
 * hic), which is how a caller knows not to go looking.
 */
export function indexCandidateNames(fileName: string) {
  const suffix = INDEX_SUFFIXES.find(([re]) => re.test(fileName))?.[1]
  return suffix ? sidecarCandidateNames(fileName, suffix) : []
}

/**
 * The index spelling a location implies: htslib writes `.csi` in place of a
 * `.bai` or a `.tbi` for a reference over 512 Mb, and on request at any size.
 */
export function resolveIndexType(
  indexName: string | undefined,
  fallback: 'BAI' | 'TBI',
) {
  return indexName?.toUpperCase().endsWith('CSI') ? 'CSI' : fallback
}
