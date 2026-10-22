import path from 'node:path'

import { guessTrack, guessTrackType } from './fileAdapter.ts'
import {
  FILE_FLAG,
  isDataFile,
  isUrl,
  modifierValue,
  splitModifier,
} from './parseArgv.ts'

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

/**
 * A command-line file as a JBrowse location: a URL is a `uri`, anything else a
 * local path.
 */
export function makeLocation(file: string): Location {
  return isUrl(file)
    ? { uri: file, locationType: 'UriLocation' }
    : { localPath: file, locationType: 'LocalPathLocation' }
}

/**
 * The format each typed track flag names, as the adapters that read it: plain,
 * then bgzipped and tabix-indexed. `--vcf calls` opens `calls` as a VCF
 * whatever its name says, and `--file calls.vcf.gz` (or a bare
 * `calls.vcf.gz`) types it by name; both build through the add-track format
 * table.
 */
export const trackFlagAdapters = {
  bam: ['BamAdapter'],
  cram: ['CramAdapter'],
  bigwig: ['BigWigAdapter'],
  bigbed: ['BigBedAdapter'],
  hic: ['HicAdapter'],
  vcf: ['VcfAdapter', 'VcfTabixAdapter'],
  gff: ['Gff3Adapter', 'Gff3TabixAdapter'],
  bed: ['BedAdapter', 'BedTabixAdapter'],
} as const satisfies Record<string, readonly string[]>

export type TrackFlag = keyof typeof trackFlagAdapters

export const trackFlags = Object.keys(trackFlagAdapters) as TrackFlag[]

function isTrackFlag(flag: string): flag is TrackFlag {
  return flag in trackFlagAdapters
}

// The name's own adapter when it is one of the flag's, else the plain one, or
// the tabix one for a `.gz` name or a named index.
function flagAdapterType(flag: TrackFlag, file: string, index?: string) {
  const adapters: readonly string[] = trackFlagAdapters[flag]
  const byName = guessTrack({ location: file, mapLocation: makeLocation })
    .adapter.type
  return adapters.includes(byName)
    ? byName
    : adapters[index || /\.b?gz$/i.test(file) ? adapters.length - 1 : 0]!
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

const GENOME_MODIFIERS = new Set(['aliases', 'cytobands'])

/**
 * The assembly a genome argument opens, `--fasta ref.fa`, `--chromSizes
 * a.sizes` or a bare genome file, with the files its `aliases:` and
 * `cytobands:` modifiers name. `--fasta` opens a name the format table does not
 * know as an indexed FASTA. `unused` is the modifiers it has no use for, for
 * the caller to report.
 */
export function genomeAssembly(
  flag: string,
  [file, ...mods]: string[],
  trackId?: string,
) {
  if (!file) {
    throw new Error(`--${flag} requires a file argument`)
  }
  const adapter = fileAdapter(file, {
    adapterType:
      flag === 'chromSizes'
        ? 'ChromSizesAdapter'
        : flag === 'fasta' && !isDataFile(file)
          ? 'IndexedFastaAdapter'
          : undefined,
  })
  if (!isSequenceAdapter(adapter)) {
    throw new Error(
      `--${flag} ${file} is not a genome: a FASTA, 2bit or .chrom.sizes file`,
    )
  }
  return {
    assembly: sequenceAssembly(adapter, file, {
      aliases: modifierValue(mods, 'aliases'),
      cytobands: modifierValue(mods, 'cytobands'),
      trackId,
    }),
    unused: mods.filter(
      mod => !GENOME_MODIFIERS.has(splitModifier(mod)?.[0] ?? ''),
    ),
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
  const index = modifierValue(mods, 'index')
  const adapter = fileAdapter(file, {
    adapterType: isTrackFlag(flag)
      ? flagAdapterType(flag, file, index)
      : undefined,
    index,
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
