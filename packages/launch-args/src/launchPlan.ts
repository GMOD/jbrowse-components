import path from 'node:path'

import {
  fileAdapter,
  fileTrack,
  isSequenceAdapter,
  sequenceAssembly,
  trackFlags,
} from './fileInput.ts'
import { genomeConfigUrl } from './genome.ts'
import {
  FILE_FLAG,
  isDataFile,
  modifierValue,
  splitModifier,
} from './parseArgv.ts'

import type { Assembly, Track } from './fileInput.ts'
import type { Entry } from './parseArgv.ts'

/**
 * What a command line asks a JBrowse app to open: a genome, the files and
 * tracks to show on it, and where. Plain JSON, so it can cross from the process
 * that read the files to the one that draws them.
 */
export interface LaunchPlan {
  /** a config.json path or URL to load first: `--genome`'s hosted one, or `--config` */
  config?: string
  /** a genome built from a file, which no config then supplies */
  assembly?: Assembly
  /** the genome the view opens on; undefined leaves it to the config's first */
  assemblyName?: string
  loc?: string
  /**
   * Tracks built from files. Without `assemblyNames` when the genome is the
   * config's, which only the app that fetches it can name.
   */
  tracks: Track[]
  /** trackIds to show, files' and `--track`'s, in command-line order */
  show: string[]
  /** modifiers this plan does not carry into the view, for the app to report */
  unapplied: string[]
}

export const launchFlags: ReadonlySet<string> = new Set([
  'genome',
  'config',
  'assembly',
  'loc',
  'track',
  'fasta',
  'aliases',
  'cytobands',
  FILE_FLAG,
  ...trackFlags,
])

// consumed while building the config, so they reach the view as config
const BUILD_MODIFIERS = new Set(['name', 'index', 'aliases', 'cytobands'])
const PATH_MODIFIERS = new Set(['index', 'aliases', 'cytobands'])

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

function isTrackFlag(key: string) {
  return key === FILE_FLAG || (trackFlags as string[]).includes(key)
}

function modifierName(mod: string) {
  return splitModifier(mod)?.[0] ?? ''
}

function uniqueId(used: Set<string>, base: string) {
  let id = base
  for (let i = 2; used.has(id); i++) {
    id = `${base}-${i}`
  }
  used.add(id)
  return id
}

/**
 * The plan a command line describes, with every local path resolved against
 * `cwd`: the directory the command ran in, which is not the app's own once a
 * second launch hands its arguments to a running one.
 */
export function launchPlan(entries: Entry[], cwd: string): LaunchPlan {
  const abs = (file: string) =>
    URL_SCHEME.test(file) ? file : path.resolve(cwd, file)
  const absMod = (mod: string) =>
    PATH_MODIFIERS.has(modifierName(mod))
      ? `${modifierName(mod)}:${abs(mod.slice(mod.indexOf(':') + 1))}`
      : mod
  const one = (key: string) => {
    const given = entries.filter(([k]) => k === key)
    if (given.length > 1) {
      throw new Error(`--${key} is given more than once`)
    }
    return given[0]?.[1][0]
  }

  const genome = one('genome')
  const config = one('config')
  const fasta = one('fasta')
  if (genome && config) {
    throw new Error('pass --genome or --config, not both')
  }
  const configRef = genome
    ? genomeConfigUrl(genome)
    : config
      ? abs(config)
      : undefined

  const resolved = entries.map(([key, values]): Entry => {
    const [file, ...mods] = values
    if (!isTrackFlag(key)) {
      return [key, values]
    } else if (!file) {
      throw new Error(`--${key} requires a file argument`)
    } else {
      return [key, [abs(file), ...mods.map(absMod)]]
    }
  })
  const fastaMods = entries.find(([key]) => key === 'fasta')?.[1].slice(1) ?? []
  const genomeFile: Entry | undefined = fasta
    ? ['fasta', [abs(fasta), ...fastaMods.map(absMod)]]
    : resolved.find(
        ([key, [file = '']]) =>
          key === FILE_FLAG && isSequenceAdapter(fileAdapter(file)),
      )
  const genomePath = genomeFile?.[1][0]
  if (genomePath && configRef) {
    throw new Error(
      `${genomePath} is a genome, and ${genome ? '--genome' : '--config'} names one too; pass one or the other`,
    )
  } else if (!genomePath && !configRef) {
    throw new Error(
      'Name a genome: a FASTA, 2bit or .chrom.sizes file, --genome hg38, or --config config.json',
    )
  } else if (genomePath && one('assembly')) {
    throw new Error(
      `--assembly picks among the genomes of --genome or --config; ${genomePath} is its own`,
    )
  }

  let assembly: Assembly | undefined
  if (genomeFile && genomePath) {
    const mods = genomeFile[1].slice(1)
    const aliases = one('aliases') ?? modifierValue(mods, 'aliases')
    const cytobands = one('cytobands') ?? modifierValue(mods, 'cytobands')
    const adapter = fileAdapter(genomePath, {
      adapterType:
        genomeFile[0] === 'fasta' && !isDataFile(genomePath)
          ? 'IndexedFastaAdapter'
          : undefined,
    })
    assembly = sequenceAssembly(adapter, genomePath, {
      aliases: aliases && abs(aliases),
      cytobands: cytobands && abs(cytobands),
    })
  }
  const assemblyName = assembly?.name ?? one('assembly')

  const used = new Set<string>()
  const tracks: Track[] = []
  const show: string[] = []
  const unapplied: string[] = []
  for (const entry of resolved) {
    const [key, [first, ...mods]] = entry
    if (key === 'track') {
      if (!first) {
        throw new Error('--track requires a trackId')
      }
      show.push(first)
      unapplied.push(...mods.map(mod => `${first} ${mod}`))
    } else if (isTrackFlag(key) && entry !== genomeFile) {
      const track = fileTrack(key, entry[1], assemblyName)
      track.trackId = uniqueId(used, track.trackId)
      tracks.push(track)
      show.push(track.trackId)
      unapplied.push(
        ...mods
          .filter(mod => !BUILD_MODIFIERS.has(modifierName(mod)))
          .map(mod => `${track.trackId} ${mod}`),
      )
    }
  }

  return {
    config: configRef,
    assembly,
    assemblyName,
    loc: one('loc'),
    tracks,
    show,
    unapplied,
  }
}
