import fs from 'fs'
import path from 'path'

import type { ViewMode } from './modes.ts'
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
  // Comparative modes (dotplot/synteny) render two assemblies. The second
  // assembly and its location are supplied alongside the primary --fasta/--loc.
  mode?: ViewMode
  fasta2?: string
  aliases2?: string
  assembly2?: string
  loc2?: string
  // Comparative view-level settings exposed as CLI flags so the simple
  // dotplot/synteny subcommands can opt in without a full --spec JSON.
  autoDiagonalize?: boolean
  drawCurves?: boolean
  // N-way comparative views: a session-spec JSON (inline or path to .json,
  // the same shape as the web's `&session=spec-`) that supplies the view's
  // sub-views and level-indexed tracks directly. Assemblies and synteny-track
  // configs it references by name come from --config. See urlparams.md.
  spec?: string
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
  // SyntenyTracks carry their compared assemblies in [query, target] order;
  // used to place the track at the right level in a multi-assembly synteny view.
  assemblyNames?: string[]
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

// Comparison/synteny adapters: each maps a CLI file type to its adapter type
// and the fileLocation slot that adapter reads from.
const syntenyAdapterMap: Record<
  string,
  [adapterType: string, locSlot: string]
> = {
  paf: ['PAFAdapter', 'pafLocation'],
  delta: ['DeltaAdapter', 'deltaLocation'],
  chain: ['ChainAdapter', 'chainLocation'],
  blasttab: ['BlastTabularAdapter', 'blastTableLocation'],
}

export const syntenyTrackTypes = Object.keys(syntenyAdapterMap)

// assemblyNames order is [query, target], matching the two views in order: the
// first --fasta/--assembly is the query (top in synteny, x-axis in dotplot),
// the second is the target.
function makeSyntenyTrackConfig(
  type: string,
  file: string,
  queryName: string,
  targetName: string,
): Track {
  const [adapterType, locSlot] = syntenyAdapterMap[type]!
  const assemblyNames = [queryName, targetName]
  return {
    type: 'SyntenyTrack',
    trackId: path.basename(file),
    name: path.basename(file),
    assemblyNames,
    adapter: {
      type: adapterType,
      [locSlot]: makeLocation(file),
      assemblyNames,
    },
  }
}

function makeFastaAssembly(
  fasta: string,
  aliases: string | undefined,
  cytobands: string | undefined,
  trackId: string,
): Assembly {
  const bgzip = fasta.endsWith('gz')
  const assembly: Assembly = {
    name: path.basename(fasta),
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId,
      adapter: {
        type: bgzip ? 'BgzipFastaAdapter' : 'IndexedFastaAdapter',
        fastaLocation: makeLocation(fasta),
        faiLocation: makeLocation(`${fasta}.fai`),
        gziLocation: bgzip ? makeLocation(`${fasta}.gzi`) : undefined,
      },
    },
  }
  if (aliases) {
    assembly.refNameAliases = {
      adapter: { type: 'RefNameAliasAdapter', location: makeLocation(aliases) },
    }
  }
  if (cytobands) {
    assembly.cytobands = {
      adapter: { type: 'CytobandAdapter', location: makeLocation(cytobands) },
    }
  }
  return assembly
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
