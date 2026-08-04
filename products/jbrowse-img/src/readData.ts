import fs from 'node:fs'
import path from 'node:path'

import { buildComparative, hasComparativeArgs } from './comparativeArgs.ts'
import {
  makeFastaAssembly,
  makeMultiWiggleTrackConfig,
  makeTrackConfig,
  syntenyTrackTypes,
} from './makeConfigs.ts'
import { modifierValue } from './parseArgv.ts'
import { STDIN_ARG, readTextInput } from './util.ts'

import type { Assembly, Config, Opts, Track } from './types.ts'

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

// `configObject` is a config already fetched off the network (from --hub or a
// URL --config, see resolveHub.ts); when present it stands in for the local
// --config file read. Its adapters use remote `uri`s, so no localPath rewriting
// applies.
export function readData(
  {
    assembly: asm,
    config,
    session,
    fasta,
    aliases,
    cytobands,
    defaultSession,
    tracks,
    trackList = [],
    argv = [],
  }: Opts,
  configObject?: Config,
) {
  let assemblyData: Assembly | undefined
  // `-` reads the assembly JSON from stdin; any other non-existent value is an
  // assembly NAME to look up in the config below
  if (asm && (asm === STDIN_ARG || fs.existsSync(asm))) {
    assemblyData = read(asm) as Assembly
    resolveLocalPaths(assemblyData, baseDirOf(asm))
  }

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
    resolveLocalPaths(configData, baseDirOf(config))
  }

  // the session.json can be a raw session or a json file with a "session"
  // attribute, which is what is exported via the "File->Export session" in
  // jbrowse-web
  if (sessionData?.session) {
    sessionData = sessionData.session as Record<string, unknown>
  }

  // only export first view (react-app2 sessions hold a `views` array). Guard on
  // a non-empty array so an empty `views: []` isn't rewritten to `[undefined]`,
  // which would crash createViewState downstream.
  if (Array.isArray(sessionData?.views) && sessionData.views.length > 0) {
    sessionData.views = [sessionData.views[0]]
  }

  // The synteny tracks of a comparative view built from CLI args; pushed once
  // configData.tracks exists below.
  let syntenyTracks: Track[] = []

  // use assembly from file if a file existed
  if (assemblyData) {
    configData.assembly = assemblyData
  }
  // else check if it was an assembly name in a config file
  else if (configData.assemblies?.length) {
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
  // single linear assembly from --fasta (trackId 'refseq' for --refseq + tests).
  else if (hasComparativeArgs(argv)) {
    const comparative = buildComparative(argv)
    configData.assemblies = comparative.assemblies
    configData.assembly = comparative.assemblies[0]!
    configData.assemblyLocs = comparative.locs
    syntenyTracks = comparative.syntenyTracks
  } else if (fasta) {
    configData.assembly = makeFastaAssembly(fasta, aliases, cytobands, 'refseq')
  }

  if (!configData.assembly) {
    throw new Error(
      'no assembly specified, use --fasta to supply an indexed FASTA file (generated with samtools faidx yourfile.fa). see README for alternatives with --assembly and --config',
    )
  }

  if (tracksData) {
    configData.tracks = tracksData
  } else if (!configData.tracks) {
    configData.tracks = []
  }
  configData.tracks.push(...syntenyTracks)

  // Regular (non-synteny) tracks attach to the primary assembly; synteny tracks
  // are built per-level in buildComparative above.
  for (const [type, opts] of trackList) {
    const [file, ...rest] = opts
    const index = modifierValue(rest, 'index')
    const name = modifierValue(rest, 'name')
    if (syntenyTrackTypes.includes(type)) {
      continue
    } else if (!file) {
      throw new Error('no file specified')
    } else if (type === 'multiwig') {
      configData.tracks.push(
        makeMultiWiggleTrackConfig(
          readMultiWiggleSources(file),
          file,
          configData.assembly,
          name,
        ),
      )
    } else {
      const trackConfig = makeTrackConfig(
        type,
        file,
        index,
        configData.assembly,
        name,
      )
      if (trackConfig) {
        configData.tracks.push(trackConfig)
      }
    }
  }

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
