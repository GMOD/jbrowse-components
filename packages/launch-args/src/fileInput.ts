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
 * The formats each typed track flag reads, each as the adapters for a plain
 * file and its bgzipped, tabix-indexed form. `--vcf calls` opens a name that
 * says none of a flag's formats as its first, `--gff genes.gtf` the format the
 * name says, and `--bed reads.bam` throws. Both build through the add-track
 * format table.
 */
export const trackFlagFormats = {
  bam: [['BamAdapter']],
  cram: [['CramAdapter']],
  bigwig: [['BigWigAdapter']],
  bigbed: [['BigBedAdapter']],
  hic: [['HicAdapter']],
  vcf: [['VcfAdapter', 'VcfTabixAdapter']],
  gff: [
    ['Gff3Adapter', 'Gff3TabixAdapter'],
    ['GtfAdapter', 'GtfTabixAdapter'],
  ],
  bed: [
    ['BedAdapter', 'BedTabixAdapter'],
    ['BedGraphAdapter', 'BedGraphTabixAdapter'],
    ['BedpeAdapter'],
  ],
} as const satisfies Record<string, readonly (readonly string[])[]>

export type TrackFlag = keyof typeof trackFlagFormats

export const trackFlags = Object.keys(trackFlagFormats) as TrackFlag[]

/** The adapters each typed track flag opens. */
export const trackFlagAdapters = Object.fromEntries(
  trackFlags.map(flag => [flag, trackFlagFormats[flag].flat()]),
) as Record<TrackFlag, string[]>

function isTrackFlag(flag: string): flag is TrackFlag {
  return Object.hasOwn(trackFlagFormats, flag)
}

const allFormats = trackFlags.flatMap<readonly string[]>(
  flag => trackFlagFormats[flag],
)

function formatOf(
  formats: readonly (readonly string[])[],
  adapterType: string,
) {
  return formats.find(format => format.includes(adapterType))
}

// The format the name says, or a typed flag's first for a name that says none
// of the track flags' formats; then its tabix adapter for a `.gz` name or a
// named index. Undefined leaves a bare file to the adapter its name says.
function chosenAdapterType(flag: string, file: string, index?: string) {
  const byName = guessTrack({ location: file, mapLocation: makeLocation })
    .adapter.type
  const own = isTrackFlag(flag) ? trackFlagFormats[flag] : allFormats
  const other = trackFlags.find(
    f => f !== flag && formatOf(trackFlagFormats[f], byName),
  )
  if (isTrackFlag(flag) && !formatOf(own, byName) && other) {
    throw new Error(
      `--${flag} ${file}: its name says a ${other} file, which --${flag} does not read; pass it bare or as --${other}`,
    )
  }
  const format =
    formatOf(own, byName) ?? (isTrackFlag(flag) ? own[0] : undefined)
  const tabix = !!index || /\.b?gz$/i.test(file)
  return format && (format[tabix ? 1 : 0] ?? format[0])
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
  const { adapter, files } = guessTrack({
    location: file,
    index,
    adapterType,
    mapLocation: makeLocation,
  })
  if (adapter.type === 'UNKNOWN' || adapter.type === 'UNSUPPORTED') {
    throw new Error(
      `JBrowse cannot tell what kind of file ${file} is from its name. Name its type with a flag: ${trackFlags.map(f => `--${f}`).join(', ')}`,
    )
  } else if (index && !files.includes(index)) {
    throw new Error(
      `${file} opens with ${adapter.type}, which reads no index, so index:${index} applies to nothing`,
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
    adapterType: chosenAdapterType(flag, file, index),
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
