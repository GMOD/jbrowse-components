import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { expandAssemblySequence } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import {
  buildComparative,
  comparativeRole,
  fileTrack,
  genomeAssembly,
  hasComparativeArgs,
  hostedComparative,
  modifierValue,
  uniqueId,
} from '@jbrowse/launch-args'

import { findAssembly } from './assemblyName.ts'
import { makeMultiWiggleTrackConfig } from './makeConfigs.ts'
import { STDIN_ARG, readTextInput } from './util.ts'

import type {
  Assembly,
  Config,
  ConfigFile,
  OpenTrack,
  Opts,
  TextSearchAdapter,
  Track,
} from './types.ts'
import type { ComparativeRow, Entry, HostedConfig } from '@jbrowse/launch-args'

function inputName(file: string) {
  return file === STDIN_ARG ? 'stdin' : file
}

function read(file: string): unknown {
  try {
    return JSON.parse(readTextInput(file)) as unknown
  } catch (e) {
    throw new Error(
      `Failed to parse ${inputName(file)} as JSON, use --fasta if you mean to pass a FASTA file`,
      { cause: e },
    )
  }
}

function baseDirOf(file: string) {
  return file === STDIN_ARG ? process.cwd() : path.dirname(path.resolve(file))
}

// A comma-separated URL list, or a `.json` array of URLs or subadapter objects
function readMultiWiggleSources(file: string): unknown[] {
  if (file !== STDIN_ARG && !file.toLowerCase().endsWith('.json')) {
    return file
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  let data: unknown
  try {
    data = JSON.parse(readTextInput(file))
  } catch (e) {
    throw new Error(`Failed to parse ${inputName(file)} as JSON`, { cause: e })
  }
  if (!Array.isArray(data)) {
    throw new Error(
      `${inputName(file)}: expected a JSON array of BigWig URLs or subadapter objects`,
    )
  }
  resolveLocalPaths(data, baseDirOf(file))
  return data
}

function resolveLocalPaths(value: unknown, baseDir: string) {
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (key === 'localPath' && typeof val === 'string') {
        obj.localPath = path.resolve(baseDir, val)
      } else {
        resolveLocalPaths(val, baseDir)
      }
    }
  }
}

function readTrackArray(file: string): Track[] {
  const data = read(file)
  if (!Array.isArray(data)) {
    throw new Error(`${inputName(file)}: expected a JSON array of tracks`)
  }
  const tracks = data as Track[]
  const baseDir = baseDirOf(file)
  for (const track of tracks) {
    resolveLocalPaths(track, baseDir)
  }
  return tracks
}

// two files with one basename would otherwise share a trackId
function uniqueTrackId(used: Set<string>, base: string) {
  const id = uniqueId(used, base)
  if (id !== base) {
    console.warn(
      `Warning: more than one track is named "${base}"; opening this one as "${id}". Pass name:<label> to tell them apart.`,
    )
  }
  return id
}

function readConfigFile(file: string) {
  const config = read(file) as ConfigFile
  const baseDir = baseDirOf(file)
  resolveLocalPaths(config, baseDir)
  addRelativeUris(config, pathToFileURL(`${baseDir}${path.sep}`))
  return config
}

// A raw session or an exported `{ session }`. A session from the LGV-only host
// holds its one view as `view`.
function readSession(file: string) {
  const raw = read(file) as Record<string, unknown>
  const session = (raw.session ?? raw) as Record<string, unknown>
  const { view, ...rest } = session
  const views: unknown[] = Array.isArray(session.views)
    ? session.views
    : view
      ? [view]
      : []
  if (views.length > 1) {
    console.warn(
      `Warning: the session has ${views.length} views; only the first is exported`,
    )
  }
  return views.length > 0 ? { ...rest, views: views.slice(0, 1) } : session
}

interface ResolvedAssemblies {
  assemblies: Assembly[]
  assembly: Assembly
  comparativeRows?: ComparativeRow[]
  aggregateTextSearchAdapters?: TextSearchAdapter[]
  syntenyTracks: Track[]
}

function configAssemblies(
  file: ConfigFile,
  asm: string | undefined,
): ResolvedAssemblies | undefined {
  const assemblies = (file.assemblies ?? []).map(expandAssemblySequence)
  const assembly = asm ? findAssembly(assemblies, asm) : assemblies[0]
  if (asm && assemblies.length > 0 && !assembly) {
    throw new Error(
      `assembly ${asm} not found in config, which has ${assemblies.map(a => a.name).join(', ')}`,
    )
  }
  return assembly
    ? {
        assemblies,
        assembly,
        aggregateTextSearchAdapters: file.aggregateTextSearchAdapters,
        syntenyTracks: [],
      }
    : undefined
}

function comparativeAssemblies(
  argv: Entry[],
  hostedConfigs: ReadonlyMap<string, HostedConfig<Assembly>>,
): ResolvedAssemblies {
  const comparative = buildComparative(argv)
  const hosted = hostedComparative(
    comparative.rows,
    comparative.syntenyTracks,
    hostedConfigs,
  )
  const assemblies = [
    ...comparative.assemblies,
    ...hosted.assemblies.map(expandAssemblySequence),
  ]
  return {
    assemblies,
    assembly:
      assemblies.find(a => a.name === comparative.rows[0]?.assembly) ??
      assemblies[0]!,
    comparativeRows: comparative.rows,
    aggregateTextSearchAdapters: hosted.textSearchAdapters,
    syntenyTracks: [...comparative.syntenyTracks, ...hosted.tracks],
  }
}

function genomeFileAssemblies([flag, values]: Entry): ResolvedAssemblies {
  const { assembly, unused } = genomeAssembly(flag, values, 'refseq')
  if (unused.length) {
    throw new Error(
      `${values[0]} takes aliases: and cytobands:, not ${unused.join(' ')}`,
    )
  }
  return { assemblies: [assembly], assembly, syntenyTracks: [] }
}

function withTracks(base: Track[], added: Track[]) {
  const tracks = [...base]
  for (const track of added) {
    const existing = tracks.findIndex(t => t.trackId === track.trackId)
    if (existing === -1) {
      tracks.push(track)
    } else {
      tracks[existing] = track
    }
  }
  return tracks
}

/**
 * `configObject` is a fetched config standing in for the --config file. It is
 * not changed, so a batch hands the same one to every record.
 */
export function readData(
  {
    assembly: asm,
    config,
    session,
    fasta,
    defaultSession,
    trackConfigs,
    trackList = [],
    argv = [],
  }: Opts,
  configObject?: ConfigFile,
  hostedConfigs: ReadonlyMap<string, HostedConfig<Assembly>> = new Map(),
): Config {
  const comparative = hasComparativeArgs(argv)
  const isGenome = (entry: Entry) =>
    entry[0] !== 'genome' && comparativeRole(entry) === 'genome'
  const genome: Entry | undefined =
    argv.find(isGenome) ??
    (fasta ? ['fasta', [fasta]] : undefined) ??
    trackList.find(isGenome)

  const file = configObject ?? (config ? readConfigFile(config) : {})
  const fromConfig = configAssemblies(file, asm)
  // the config's assemblies would win, dropping the genome file and every
  // comparison file bound to it
  if (fromConfig && genome) {
    throw new Error(
      `${genome[1][0]} is a genome, and the config (--config or --genome) names its own; pass one or the other, and --assembly <name> to choose among the config's`,
    )
  } else if (fromConfig && comparative) {
    throw new Error(
      "a comparative view stacks genome files and --genome names, and --config names its own genomes; pass those, or a --spec naming the config's comparison tracks",
    )
  }
  const resolved =
    fromConfig ??
    (comparative
      ? comparativeAssemblies(argv, hostedConfigs)
      : genome
        ? genomeFileAssemblies(genome)
        : undefined)
  if (!resolved) {
    throw new Error(
      'no assembly specified: pass a genome file (an indexed FASTA from samtools faidx, a 2bit, or a .chrom.sizes), --fasta, --genome, or --config',
    )
  }
  const { assembly, syntenyTracks, ...assemblies } = resolved

  const tracks = withTracks(
    file.tracks ?? [],
    trackConfigs ? readTrackArray(trackConfigs) : [],
  )
  const usedTrackIds = new Set(tracks.map(t => t.trackId))
  for (const track of syntenyTracks) {
    tracks.push({
      ...track,
      trackId: uniqueTrackId(usedTrackIds, track.trackId),
    })
  }

  const openTracks: OpenTrack[] = []
  for (const [type, opts] of trackList) {
    const [file, ...rest] = opts
    const consumed = comparative
      ? !!comparativeRole([type, opts])
      : isGenome([type, opts]) && file === genome?.[1][0]
    if (!consumed) {
      if (!file) {
        throw new Error(`--${type} requires a file argument`)
      }
      const built =
        type === 'multiwig'
          ? makeMultiWiggleTrackConfig(
              readMultiWiggleSources(file),
              file,
              assembly,
              modifierValue(rest, 'name'),
            )
          : fileTrack(type, opts, assembly.name)
      const trackId = uniqueTrackId(usedTrackIds, built.trackId)
      tracks.push({ ...built, trackId })
      openTracks.push({ trackId, opts: rest })
    }
  }

  return {
    ...assemblies,
    assembly,
    tracks,
    openTracks,
    // it can name assemblies other than the one opened
    defaultSession: session
      ? readSession(session)
      : defaultSession
        ? file.defaultSession
        : undefined,
  }
}
