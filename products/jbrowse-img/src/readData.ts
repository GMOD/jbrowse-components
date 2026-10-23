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
  isGenomeFlag,
  modifierValue,
  uniqueId,
} from '@jbrowse/launch-args'

import { makeMultiWiggleTrackConfig, syntenyTrackTypes } from './makeConfigs.ts'
import { STDIN_ARG, readTextInput } from './util.ts'

import type { Assembly, Config, OpenTrack, Opts, Track } from './types.ts'
import type { Entry, HostedConfig } from '@jbrowse/launch-args'

// how to name an input in an error message
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

// a `localPath` inside a JSON input resolves relative to that input's file; piped
// JSON has no file, so its paths resolve against the cwd the pipe ran in
function baseDirOf(file: string) {
  return file === STDIN_ARG ? process.cwd() : path.dirname(path.resolve(file))
}

// The `--multiwig` argument is either a path/URL list (comma-separated BigWig
// URLs → the `bigWigs` shorthand) or a `.json` file holding an array of BigWig
// URLs or full subadapter objects. A JSON file's `localPath`s resolve relative
// to that file, matching how --tracks/--config paths resolve.
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

// Resolve every `localPath` nested anywhere in `value` relative to `baseDir`,
// so paths inside a config/assembly/tracks JSON are relative to that file.
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

// --tracks names a JSON array of track configs, whose localPaths resolve relative
// to it (or to the cwd when piped)
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

// `--bam tumor/sample.bam --bam normal/sample.bam` would open one track under
// one id; the second gets a suffix, and both keep the basename as their name.
function uniqueTrackId(used: Set<string>, base: string) {
  const id = uniqueId(used, base)
  if (id !== base) {
    console.warn(
      `Warning: more than one track is named "${base}"; opening this one as "${id}". Pass name:<label> to tell them apart.`,
    )
  }
  return id
}

// `configObject` is a config already fetched off the network (from --genome or a
// URL --config, see resolveHub.ts); when present it stands in for the local
// --config file read. Its adapters use remote `uri`s, so no localPath rewriting
// applies. A --config file is the other way about: a `uri` in it relative to
// the file, as a config a web server hosts beside its data writes them, is a
// file beside it.
export function readData(
  {
    assembly: asm,
    config,
    session,
    fasta,
    defaultSession,
    tracks,
    trackList = [],
    argv = [],
  }: Opts,
  configObject?: Config,
  hostedConfigs: ReadonlyMap<string, HostedConfig<Assembly>> = new Map(),
) {
  // the genome a linear view opens on: --fasta (a library caller passes it bare),
  // or a bare genome file
  const comparative = hasComparativeArgs(argv)
  const genome: Entry | undefined =
    argv.find(([key]) => isGenomeFlag(key)) ??
    (fasta ? ['fasta', [fasta]] : undefined) ??
    trackList.find(entry => comparativeRole(entry) === 'genome')

  const tracksData = tracks ? readTrackArray(tracks) : undefined
  const configData: Partial<Config> & Record<string, unknown> = configObject
    ? configObject
    : config
      ? (read(config) as Config)
      : {}

  let sessionData = session
    ? (read(session) as Record<string, unknown>)
    : undefined

  if (config && !configObject) {
    const baseDir = baseDirOf(config)
    resolveLocalPaths(configData, baseDir)
    addRelativeUris(configData, pathToFileURL(`${baseDir}${path.sep}`))
  }

  // the session.json can be a raw session or a json file with a "session"
  // attribute, which is what is exported via the "File->Export session" in
  // jbrowse-web
  if (sessionData?.session) {
    sessionData = sessionData.session as Record<string, unknown>
  }

  // A session saved against the LGV-only react2 host — which jb2export used
  // before react-app2 — holds a single `view` rather than a `views` array. Its
  // one view is what react-app2 wants as views[0]; left alone it is an unknown
  // key that the session model drops, and the export came out blank with
  // nothing reported.
  if (sessionData?.view && !sessionData.views) {
    sessionData.views = [sessionData.view]
    delete sessionData.view
  }

  // only export first view (react-app2 sessions hold a `views` array). Guard on
  // a non-empty array so an empty `views: []` isn't rewritten to `[undefined]`,
  // which would crash createViewState downstream.
  if (Array.isArray(sessionData?.views) && sessionData.views.length > 0) {
    if (sessionData.views.length > 1) {
      console.warn(
        `Warning: the session has ${sessionData.views.length} views; only the first is exported`,
      )
    }
    sessionData.views = [sessionData.views[0]]
  }

  // The synteny tracks of a comparative view built from CLI args; pushed once
  // configData.tracks exists below.
  let syntenyTracks: Track[] = []

  if (configData.assemblies?.length) {
    configData.assemblies = configData.assemblies.map(expandAssemblySequence)
  }
  if (configData.assemblies?.length) {
    // --config/--genome and the CLI assembly flags are alternatives, not
    // additive: the config's assemblies would win, dropping the genome file and
    // every comparison file that binds to it
    if (genome) {
      throw new Error(
        `${genome[1][0]} is a genome, and the config (--config or --genome) names its own; pass one or the other, and --assembly <name> to choose among the config's`,
      )
    } else if (comparative) {
      throw new Error(
        "a comparative view stacks genome files and --genome names, and --config names its own genomes; pass those, or a --spec naming the config's comparison tracks",
      )
    }
    if (asm) {
      const assembly = configData.assemblies.find(entry => entry.name === asm)
      if (!assembly) {
        throw new Error(`assembly ${asm} not found in config`)
      }
      configData.assembly = assembly
    } else {
      configData.assembly = configData.assemblies[0]!
    }
  }
  // else build the assemblies from CLI args: a comparative view's stacked
  // assemblies + per-level synteny tracks (--fasta/--chromSizes/--paf/…), or a
  // single linear assembly from the genome (trackId 'refseq' for --refseq).
  else if (comparative) {
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
    configData.assemblies = assemblies
    configData.assembly =
      assemblies.find(a => a.name === comparative.rows[0]?.assembly) ??
      assemblies[0]
    configData.comparativeRows = comparative.rows
    configData.aggregateTextSearchAdapters = hosted.textSearchAdapters
    syntenyTracks = [...comparative.syntenyTracks, ...hosted.tracks]
  } else if (genome) {
    const { assembly, unused } = genomeAssembly(genome[0], genome[1], 'refseq')
    if (unused.length) {
      throw new Error(
        `${genome[1][0]} takes aliases: and cytobands:, not ${unused.join(' ')}`,
      )
    }
    configData.assembly = assembly
  }

  if (!configData.assembly) {
    throw new Error(
      'no assembly specified: pass a genome file (an indexed FASTA from samtools faidx, a 2bit, or a .chrom.sizes), --fasta, --genome, or --config',
    )
  }

  if (!configData.tracks) {
    configData.tracks = []
  }
  const configTracks = configData.tracks
  for (const track of tracksData ?? []) {
    const existing = configTracks.findIndex(t => t.trackId === track.trackId)
    if (existing === -1) {
      configTracks.push(track)
    } else {
      configTracks[existing] = track
    }
  }
  const usedTrackIds = new Set(configData.tracks.map(t => t.trackId))
  for (const track of syntenyTracks) {
    track.trackId = uniqueTrackId(usedTrackIds, track.trackId)
    configData.tracks.push(track)
  }

  // Other tracks attach to the primary assembly; the genomes and comparisons
  // went into buildComparative above. Each one is recorded in `openTracks`
  // under the id it actually got, so the renderer opens exactly what was built
  // instead of recomputing the id from the filename.
  const openTracks: OpenTrack[] = []
  for (const [type, opts] of trackList) {
    const [file, ...rest] = opts
    const consumed =
      opts === genome?.[1] ||
      syntenyTrackTypes.includes(type) ||
      (comparative && !!comparativeRole([type, opts]))
    if (!consumed) {
      if (!file) {
        throw new Error(`--${type} requires a file argument`)
      }
      const trackConfig =
        type === 'multiwig'
          ? makeMultiWiggleTrackConfig(
              readMultiWiggleSources(file),
              file,
              configData.assembly,
              modifierValue(rest, 'name'),
            )
          : fileTrack(type, opts, configData.assembly.name)
      trackConfig.trackId = uniqueTrackId(usedTrackIds, trackConfig.trackId)
      configData.tracks.push(trackConfig)
      openTracks.push({ trackId: trackConfig.trackId, opts: rest })
    }
  }
  configData.openTracks = openTracks

  if (!defaultSession) {
    // don't use defaultSession from config.json file, can result in assembly
    // name confusion
    configData.defaultSession = undefined
  }

  // only allow an external manually specified session
  if (sessionData) {
    configData.defaultSession = sessionData
  }

  // Normalize to a non-empty assemblies array so downstream code (and the
  // react-app2 config) never has to special-case the single-assembly path.
  if (!configData.assemblies?.length) {
    configData.assemblies = [configData.assembly]
  }

  // assembly and tracks are guaranteed set above (throw otherwise)
  return configData as Config
}
