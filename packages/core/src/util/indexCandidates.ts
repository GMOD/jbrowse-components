import { getFileName } from './getFileName.ts'

import type { FileLocation } from './types/index.ts'

/**
 * Every conventional spelling of an index file, for the docs that describe this
 * behavior. Kept beside {@link indexCandidateNames}, which is the list actually
 * probed, so the two are edited together.
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

/**
 * The index filenames worth looking for beside `fileName`, best guess first.
 *
 * One data file has several names its index might carry, and picking only the
 * first left everyone else with a missing-file error naming a path they never
 * wrote:
 *
 * - `<file>.bai` / `.crai` / `.tbi` is what samtools and tabix write
 * - `<file>.csi` is what htslib writes for a reference over 512 Mb, and on
 *   request at any size
 * - `reads.bai` beside `reads.bam` is what Picard and GATK write, in place of
 *   samtools' `reads.bam.bai`
 *
 * Empty for a file type that carries no sibling index (BigWig, BigBed, hic),
 * which is how a caller knows not to go looking.
 */
export function indexCandidateNames(fileName: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.bam')) {
    return [
      `${fileName}.bai`,
      `${fileName}.csi`,
      fileName.replace(/\.bam$/i, '.bai'),
    ]
  }
  if (lower.endsWith('.cram')) {
    return [`${fileName}.crai`, fileName.replace(/\.cram$/i, '.crai')]
  }
  // the tabix family is spelled by its compression, not its content: a .gz here
  // is a bgzipped VCF/GFF/BED/SAM, all of which index the same two ways
  if (lower.endsWith('.gz')) {
    return [`${fileName}.tbi`, `${fileName}.csi`]
  }
  return []
}

/**
 * `location` with its filename replaced, i.e. the sibling of a data file.
 *
 * Only a URI and a local path have a sibling at all. A Blob or a FileHandle is
 * whatever the user picked out of a file dialog and there is no directory
 * around it to look in, so those get `undefined` — the honest answer, and the
 * reason index detection cannot work from a browser file picker.
 */
export function siblingLocation(
  location: FileLocation,
  fileName: string,
): FileLocation | undefined {
  const replaceLast = (path: string) =>
    // the separator is kept: a Windows local path uses backslashes and a URI
    // never does, so rebuilding with '/' would corrupt one of them
    path.replace(/[^/\\]*$/, fileName)
  if (location.locationType === 'UriLocation') {
    return { ...location, uri: replaceLast(location.uri) }
  }
  if (location.locationType === 'LocalPathLocation') {
    return { ...location, localPath: replaceLast(location.localPath) }
  }
  return undefined
}

/**
 * The index sitting beside `location`, or undefined when none of the
 * conventional spellings is there.
 *
 * `exists` is injected rather than reached for, because what "exists" costs is
 * the caller's business and differs by host: a local path is a stat, a URL is a
 * request, and a Blob cannot be asked at all.
 */
export async function detectIndexLocation(
  location: FileLocation,
  exists: (location: FileLocation) => Promise<boolean>,
) {
  for (const name of indexCandidateNames(getFileName(location))) {
    const candidate = siblingLocation(location, name)
    if (candidate && (await exists(candidate))) {
      return candidate
    }
  }
  return undefined
}
