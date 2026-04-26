import fs from 'fs'
import path from 'path'

import type { Entry } from './parseArgv.ts'

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
  return file.startsWith('http') ? { uri: file } : { localPath: file }
}

function addRelativePaths(config: Record<string, unknown>, configPath: string) {
  for (const key of Object.keys(config)) {
    const val = config[key]
    if (val !== null && typeof val === 'object') {
      addRelativePaths(val as Record<string, unknown>, configPath)
    } else if (key === 'localPath') {
      config.localPath = path.resolve(configPath, val as string)
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
  opts: string[],
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
    ...(opts.includes('snpcov')
      ? {
          displays: [
            {
              type: 'LinearSNPCoverageDisplay',
              displayId: `${path.basename(file)}-${Math.random()}`,
            },
          ],
        }
      : {}),
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
  const assemblyData =
    asm && fs.existsSync(asm) ? (read(asm) as Assembly) : undefined
  const rawTracksData = tracks ? read(tracks) : undefined
  if (rawTracksData !== undefined && !Array.isArray(rawTracksData)) {
    throw new Error(`${tracks}: expected a JSON array of tracks`)
  }
  const tracksData = rawTracksData as Track[] | undefined
  const configData = config ? (read(config) as Config) : ({} as Config)

  let sessionData = session
    ? (read(session) as Record<string, unknown>)
    : undefined

  if (config) {
    addRelativePaths(configData, path.dirname(path.resolve(config)))
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

  // throw if still no assembly
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!configData.assembly) {
    throw new Error(
      'no assembly specified, use --fasta to supply an indexed FASTA file (generated with samtools faidx yourfile.fa). see README for alternatives with --assembly and --config',
    )
  }

  if (tracksData) {
    configData.tracks = tracksData
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  else if (!configData.tracks) {
    configData.tracks = []
  }

  for (const track of trackList) {
    const [type, opts] = track
    const [file, ...rest] = opts
    const index = rest.find(r => r.startsWith('index:'))?.replace('index:', '')
    if (!file) {
      throw new Error('no file specified')
    }
    const trackConfig = makeTrackConfig(
      type,
      file,
      index,
      opts,
      configData.assembly,
    )
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

  return configData
}
