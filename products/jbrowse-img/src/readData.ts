import fs from 'fs'
import path from 'path'

import {
  makeFastaAssembly,
  makeSyntenyTrackConfig,
  makeTrackConfig,
  syntenyTrackTypes,
} from './makeConfigs.ts'

import type { Assembly, Config, Opts, Track } from './types.ts'

function read(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  } catch (e) {
    throw new Error(
      `Failed to parse ${file} as JSON, use --fasta if you mean to pass a FASTA file`,
      { cause: e },
    )
  }
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

export function readData({
  assembly: asm,
  config,
  session,
  fasta,
  aliases,
  cytobands,
  defaultSession,
  tracks,
  trackList = [],
  fasta2,
  aliases2,
  assembly2,
}: Opts) {
  let assemblyData: Assembly | undefined
  if (asm && fs.existsSync(asm)) {
    assemblyData = read(asm) as Assembly
    resolveLocalPaths(assemblyData, path.dirname(path.resolve(asm)))
  }

  const rawTracksData = tracks ? read(tracks) : undefined
  if (rawTracksData !== undefined && !Array.isArray(rawTracksData)) {
    throw new Error(`${tracks}: expected a JSON array of tracks`)
  }
  const tracksData = rawTracksData as Track[] | undefined
  if (tracksData && tracks) {
    const baseDir = path.dirname(path.resolve(tracks))
    for (const track of tracksData) {
      resolveLocalPaths(track, baseDir)
    }
  }
  const configData: Partial<Config> & Record<string, unknown> = config
    ? (read(config) as Config)
    : {}

  let sessionData = session
    ? (read(session) as Record<string, unknown>)
    : undefined

  if (config) {
    resolveLocalPaths(configData, path.dirname(path.resolve(config)))
  }

  // the session.json can be a raw session or a json file with a "session"
  // attribute, which is what is exported via the "File->Export session" in
  // jbrowse-web
  if (sessionData?.session) {
    sessionData = sessionData.session as Record<string, unknown>
  }

  // only export first view (react-app2 sessions hold a `views` array)
  if (sessionData?.views) {
    sessionData.views = [(sessionData.views as Record<string, unknown>[])[0]]
  }

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
  // else load fasta from command line. trackId stays 'refseq' for the primary
  // assembly (back-compat with the --refseq flag and tests).
  else if (fasta) {
    configData.assembly = makeFastaAssembly(fasta, aliases, cytobands, 'refseq')
  }

  if (!configData.assembly) {
    throw new Error(
      'no assembly specified, use --fasta to supply an indexed FASTA file (generated with samtools faidx yourfile.fa). see README for alternatives with --assembly and --config',
    )
  }

  // Second assembly for comparative modes (dotplot/synteny). The view init
  // reads both from configData.assemblies in order [primary, secondary].
  if (fasta2 || assembly2) {
    let secondary: Assembly | undefined
    if (fasta2) {
      const trackId = `${path.basename(fasta2)}-refseq`
      secondary = makeFastaAssembly(fasta2, aliases2, undefined, trackId)
    } else if (assembly2 && configData.assemblies?.length) {
      secondary = configData.assemblies.find(entry => entry.name === assembly2)
      if (!secondary) {
        throw new Error(`assembly2 ${assembly2} not found in config`)
      }
    }
    if (!secondary) {
      throw new Error(
        `could not resolve second assembly (--fasta2 ${fasta2 ?? ''} --assembly2 ${assembly2 ?? ''})`,
      )
    }
    configData.assemblies = [configData.assembly, secondary]
  }

  if (tracksData) {
    configData.tracks = tracksData
  } else if (!configData.tracks) {
    configData.tracks = []
  }

  const secondaryAssembly = configData.assemblies?.[1]
  for (const track of trackList) {
    const [type, opts] = track
    const [file, ...rest] = opts
    const index = rest.find(r => r.startsWith('index:'))?.slice('index:'.length)
    if (!file) {
      throw new Error('no file specified')
    } else if (syntenyTrackTypes.includes(type)) {
      if (!secondaryAssembly) {
        throw new Error(
          `comparison track "${type}" requires a second assembly (--fasta2 or --assembly2)`,
        )
      } else {
        configData.tracks.push(
          makeSyntenyTrackConfig(
            type,
            file,
            configData.assembly.name,
            secondaryAssembly.name,
          ),
        )
      }
    } else {
      const trackConfig = makeTrackConfig(
        type,
        file,
        index,
        configData.assembly,
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
