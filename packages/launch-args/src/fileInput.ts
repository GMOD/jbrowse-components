import path from 'node:path'

import { guessTrack, guessTrackType } from './fileAdapter.ts'
import { FILE_FLAG, modifierValue } from './parseArgv.ts'

import type { Adapter, Location } from './fileAdapter.ts'

export interface Assembly {
  name: string
  sequence: Record<string, unknown>
  refNameAliases?: Record<string, unknown>
  cytobands?: Record<string, unknown>
}

export interface Track {
  trackId: string
  displays?: unknown[]
  adapter?: Record<string, unknown>
  // a SyntenyTrack's are [query, target], which places it at its level
  assemblyNames?: string[]
  [key: string]: unknown
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * A command-line file as a JBrowse location: a URL (http, s3, ftp, …) is a
 * `uri`, anything else a local path.
 */
export function makeLocation(file: string): Location {
  return URL_SCHEME.test(file)
    ? { uri: file, locationType: 'UriLocation' }
    : { localPath: file, locationType: 'LocalPathLocation' }
}

/**
 * The adapter each typed track flag names. `--bam reads` opens `reads` as BAM
 * whatever its name says, and `--file reads.bam` (or a bare `reads.bam`) types
 * it by name; both build through the add-track format table.
 */
export const trackFlagAdapters = {
  bam: 'BamAdapter',
  cram: 'CramAdapter',
  bigwig: 'BigWigAdapter',
  vcfgz: 'VcfTabixAdapter',
  gffgz: 'Gff3TabixAdapter',
  hic: 'HicAdapter',
  bigbed: 'BigBedAdapter',
  bedgz: 'BedTabixAdapter',
} as const

export type TrackFlag = keyof typeof trackFlagAdapters

export const trackFlags = Object.keys(trackFlagAdapters) as TrackFlag[]

function isTrackFlag(flag: string): flag is TrackFlag {
  return flag in trackFlagAdapters
}

const SEQUENCE_TRACK = 'ReferenceSequenceTrack'

/**
 * The adapter for one file argument: `adapterType`'s when given, else the one
 * its name says. Its index is found beside it unless `index` names one. Throws
 * for a file the format table cannot type, naming the flags that would.
 */
export function fileAdapter(
  file: string,
  { adapterType, index }: { adapterType?: string; index?: string } = {},
) {
  const { adapter } = guessTrack({
    location: file,
    index,
    adapterType,
    mapLocation: makeLocation,
  })
  if (adapter.type === 'UNKNOWN' || adapter.type === 'UNSUPPORTED') {
    throw new Error(
      `JBrowse cannot tell what kind of file ${file} is from its name. Name its type with a flag: ${trackFlags.map(f => `--${f}`).join(', ')}`,
    )
  }
  return adapter
}

export function isSequenceAdapter(adapter: Adapter) {
  return guessTrackType(adapter.type) === SEQUENCE_TRACK
}

/**
 * An assembly from a sequence file's adapter, named after the file, with the
 * `aliases:` and `cytobands:` files a modifier or flag gives it.
 */
export function sequenceAssembly(
  adapter: Adapter,
  file: string,
  {
    aliases,
    cytobands,
    trackId = 'refseq',
  }: { aliases?: string; cytobands?: string; trackId?: string } = {},
): Assembly {
  return {
    name: path.basename(file).replace(/\.(chrom\.)?sizes$/i, ''),
    sequence: { type: SEQUENCE_TRACK, trackId, adapter },
    ...(aliases
      ? {
          refNameAliases: {
            adapter: {
              type: 'RefNameAliasAdapter',
              location: makeLocation(aliases),
            },
          },
        }
      : {}),
    ...(cytobands
      ? {
          cytobands: {
            adapter: {
              type: 'CytobandAdapter',
              cytobandLocation: makeLocation(cytobands),
            },
          },
        }
      : {}),
  }
}

/**
 * A track for one file argument, labelled by `name:` or the file's basename.
 * Without `assemblyName` it names no assembly, for a caller that learns the
 * assembly later, from a config it has yet to fetch.
 */
export function fileTrack(
  flag: string,
  [file, ...mods]: string[],
  assemblyName?: string,
): Track {
  if (!file) {
    throw new Error(`--${flag} requires a file argument`)
  }
  if (!isTrackFlag(flag) && flag !== FILE_FLAG) {
    throw new Error(`--${flag} is not a file flag`)
  }
  const adapter = fileAdapter(file, {
    adapterType: isTrackFlag(flag) ? trackFlagAdapters[flag] : undefined,
    index: modifierValue(mods, 'index'),
  })
  if (isSequenceAdapter(adapter)) {
    throw new Error(
      `${file} is a genome, and this view already has one; open one genome per view`,
    )
  }
  return {
    type: guessTrackType(adapter.type, file),
    trackId: path.basename(file),
    name: modifierValue(mods, 'name') ?? path.basename(file),
    ...(assemblyName ? { assemblyNames: [assemblyName] } : {}),
    adapter,
  }
}
