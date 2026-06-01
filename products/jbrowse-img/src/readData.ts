import fs from 'fs'
import path from 'path'

import type { Entry } from './parseArgv.ts'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

export interface Opts {
  noRasterize?: boolean
  loc?: string
  width?: number
  session?: string
  assembly?: string
  config?: string
  fasta?: string
  aliases?: string
  cytobands?: string
  defaultSession?: boolean
  trackList?: Entry[]
  tracks?: string
  themeName?: string
  showGridlines?: boolean
  trackLabels?: TrackLabelMode
  refseq?: boolean
}

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

export function makeLocation(file: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(file)
    ? { uri: file }
    : { localPath: file }
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

export interface Assembly {
  name: string
  sequence: Record<string, unknown>
  refNameAliases?: Record<string, unknown>
  cytobands?: Record<string, unknown>
}

export interface Track {
  trackId: string
  displays?: unknown[]
  [key: string]: unknown
}

export interface Config {
  assemblies: Assembly[]
  assembly: Assembly
  tracks: Track[]
  [key: string]: unknown
}

const trackTypeMap: Record<string, string> = {
  bam: 'AlignmentsTrack',
  cram: 'AlignmentsTrack',
  bigwig: 'QuantitativeTrack',
  vcfgz: 'VariantTrack',
  gffgz: 'FeatureTrack',
  hic: 'HicTrack',
  bigbed: 'FeatureTrack',
  bedgz: 'FeatureTrack',
}

export const trackTypes = Object.keys(trackTypeMap)

function makeTabixIndex(file: string, index: string | undefined) {
  return {
    location: makeLocation(index || `${file}.tbi`),
    indexType: index?.endsWith('.csi') ? 'CSI' : 'TBI',
  }
}

function makeAdapter(
  type: string,
  file: string,
  index: string | undefined,
  sequenceAdapter: unknown,
) {
  if (type === 'bam') {
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(file),
      index: {
        location: makeLocation(index || `${file}.bai`),
        indexType: index?.endsWith('.csi') ? 'CSI' : 'BAI',
      },
      sequenceAdapter,
    }
  }
  if (type === 'cram') {
    return {
      type: 'CramAdapter',
      cramLocation: makeLocation(file),
      craiLocation: makeLocation(index || `${file}.crai`),
      sequenceAdapter,
    }
  }
  if (type === 'bigwig') {
    return { type: 'BigWigAdapter', bigWigLocation: makeLocation(file) }
  }
  if (type === 'vcfgz') {
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }
  }
  if (type === 'gffgz') {
    return {
      type: 'Gff3TabixAdapter',
      gffGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }
  }
  if (type === 'hic') {
    return { type: 'HicAdapter', hicLocation: makeLocation(file) }
  }
  if (type === 'bigbed') {
    return { type: 'BigBedAdapter', bigBedLocation: makeLocation(file) }
  }
  if (type === 'bedgz') {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }
  }
  return undefined
}

export function makeTrackConfig(
  type: string,
  file: string,
  index: string | undefined,
  assembly: Assembly,
): Track | undefined {
  const trackType = trackTypeMap[type]
  const adapter = makeAdapter(type, file, index, assembly.sequence.adapter)
  if (!trackType || !adapter) {
    return undefined
  }
  return {
    type: trackType,
    trackId: path.basename(file),
    name: path.basename(file),
    assemblyNames: [assembly.name],
    adapter,
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

  // only export first view
  if (sessionData?.views) {
    sessionData.view = (sessionData.views as Record<string, unknown>[])[0]
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
  // else load fasta from command line
  else if (fasta) {
    const bgzip = fasta.endsWith('gz')

    configData.assembly = {
      name: path.basename(fasta),
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'refseq',
        adapter: {
          type: bgzip ? 'BgzipFastaAdapter' : 'IndexedFastaAdapter',
          fastaLocation: makeLocation(fasta),
          faiLocation: makeLocation(`${fasta}.fai`),
          gziLocation: bgzip ? makeLocation(`${fasta}.gzi`) : undefined,
        },
      },
    }
    if (aliases) {
      configData.assembly.refNameAliases = {
        adapter: {
          type: 'RefNameAliasAdapter',
          location: makeLocation(aliases),
        },
      }
    }
    if (cytobands) {
      configData.assembly.cytobands = {
        adapter: {
          type: 'CytobandAdapter',
          location: makeLocation(cytobands),
        },
      }
    }
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

  for (const track of trackList) {
    const [type, opts] = track
    const [file, ...rest] = opts
    const index = rest.find(r => r.startsWith('index:'))?.slice('index:'.length)
    if (!file) {
      throw new Error('no file specified')
    }
    const trackConfig = makeTrackConfig(type, file, index, configData.assembly)
    if (trackConfig) {
      configData.tracks.push(trackConfig)
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

  // assembly and tracks are guaranteed set above (throw otherwise)
  return configData as Config
}
