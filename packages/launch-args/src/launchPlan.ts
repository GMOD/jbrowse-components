import path from 'node:path'

import {
  buildComparative,
  comparativeRole,
  hasComparativeArgs,
  stackedViews,
  syntenyFlags,
} from './comparative.ts'
import { checkModifiers } from './displaySettings.ts'
import {
  fileAdapter,
  fileTrack,
  genomeAssembly,
  isSequenceAdapter,
  trackFlags,
} from './fileInput.ts'
import { genomeConfigUrl } from './genome.ts'
import { FILE_FLAG, isUrl, locValue, splitModifier } from './parseArgv.ts'
import { viewSettings } from './slotPath.ts'

import type { Assembly, Track } from './fileInput.ts'
import type { Entry } from './parseArgv.ts'

/**
 * The views jb2export's subcommand words name, which Desktop takes as its
 * first argument too.
 */
export const launchViewTypes = {
  lgv: 'LinearGenomeView',
  synteny: 'LinearSyntenyView',
  dotplot: 'DotplotView',
} as const

export type LaunchViewType =
  (typeof launchViewTypes)[keyof typeof launchViewTypes]

export function launchViewType(word: string): LaunchViewType | undefined {
  return Object.hasOwn(launchViewTypes, word)
    ? launchViewTypes[word as keyof typeof launchViewTypes]
    : undefined
}

/**
 * What a command line asks a JBrowse app to open: genomes, the files and
 * tracks to show on them, and where. Plain JSON, so it can cross from the
 * process that read the files to the one that draws them.
 */
export type LaunchPlan = LinearLaunchPlan | ComparativeLaunchPlan

interface PlanBase {
  /** settings `--view` writes on the view, as a session spec's view holds them */
  view: Record<string, unknown>
  /** modifiers this plan does not carry into the view, for the app to report */
  unapplied: string[]
}

export interface LinearLaunchPlan extends PlanBase {
  type: 'LinearGenomeView'
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
  /**
   * The tracks to show, files' and `--track`'s, in command-line order, each
   * with the modifiers the app applies once it knows the track's display
   */
  show: ShowTrack[]
}

/** A synteny view or dotplot of genomes built from files. */
export interface ComparativeLaunchPlan extends PlanBase {
  type: 'LinearSyntenyView' | 'DotplotView'
  /** top row first, which is a dotplot's x axis */
  assemblies: Assembly[]
  /** one row per genome, as a session spec's comparative view lists them */
  views: { assembly: string; loc?: string }[]
  /** the comparison files' tracks, each between the genomes it compares */
  tracks: Track[]
}

export interface ShowTrack {
  trackId: string
  modifiers: string[]
}

// the app applies modifiers once the track is open, so a bad one fails here
function showTrack(trackId: string, modifiers: string[]): ShowTrack {
  try {
    checkModifiers(modifiers)
  } catch (e) {
    throw new Error(`${trackId}: ${e instanceof Error ? e.message : e}`, {
      cause: e,
    })
  }
  return { trackId, modifiers }
}

export const launchFlags: ReadonlySet<string> = new Set([
  'genome',
  'config',
  'assembly',
  'loc',
  'view',
  'track',
  'fasta',
  'chromSizes',
  FILE_FLAG,
  ...trackFlags,
  ...syntenyFlags,
])

/**
 * jb2export's flags that take only true or false, so a file after one is a
 * file of its own. Desktop reads them to report one without taking the file.
 */
export const exportBooleanFlags: ReadonlySet<string> = new Set([
  'noRasterize',
  'defaultSession',
  'showGridlines',
  'refseq',
  'passOnly',
  'resume',
  'manifest',
  'dryRun',
])

const PATH_MODIFIERS = new Set(['index', 'aliases', 'cytobands'])

function isTrackFlag(key: string) {
  return key === FILE_FLAG || (trackFlags as string[]).includes(key)
}

function takesFile(key: string) {
  return (
    isTrackFlag(key) ||
    key === 'fasta' ||
    key === 'chromSizes' ||
    (syntenyFlags as string[]).includes(key)
  )
}

function modifierName(mod: string) {
  return splitModifier(mod)?.[0] ?? ''
}

/**
 * `base`, or the first of `base-2`, `base-3`, ... that `used` lacks, which it
 * adds to `used`.
 */
export function uniqueId(used: Set<string>, base: string) {
  let id = base
  for (let i = 2; used.has(id); i++) {
    id = `${base}-${i}`
  }
  used.add(id)
  return id
}

function entryText([key, values]: Entry) {
  return [...(key === FILE_FLAG ? [] : [`--${key}`]), ...values].join(' ')
}

/**
 * The plan a command line describes, with every local path resolved against
 * `cwd`: the directory the command ran in, which is not the app's own once a
 * second launch hands its arguments to a running one.
 *
 * `viewType` is the view a subcommand word named. Without one, a second genome
 * or a comparison file opens a synteny view, and anything else a linear one.
 */
export function launchPlan(
  entries: Entry[],
  cwd: string,
  viewType?: LaunchViewType,
): LaunchPlan {
  const abs = (file: string) => (isUrl(file) ? file : path.resolve(cwd, file))
  const absMod = (mod: string) =>
    PATH_MODIFIERS.has(modifierName(mod))
      ? `${modifierName(mod)}:${abs(mod.slice(mod.indexOf(':') + 1))}`
      : mod
  const resolved = entries.map(([key, values]): Entry => {
    const [file, ...mods] = values
    if (!takesFile(key)) {
      return [key, values]
    } else if (!file) {
      throw new Error(`--${key} requires a file argument`)
    } else {
      return [key, [abs(file), ...mods.map(absMod)]]
    }
  })
  const type =
    viewType ??
    (hasComparativeArgs(resolved) ? 'LinearSyntenyView' : 'LinearGenomeView')
  return type === 'LinearGenomeView'
    ? linearPlan(resolved, abs)
    : comparativePlan(resolved, type)
}

function givenOnce(entries: Entry[], key: string) {
  const found = entries.filter(([k]) => k === key)
  if (found.length > 1) {
    throw new Error(`--${key} is given more than once`)
  }
  return found[0]?.[1]
}

const VIEW_NAMES = {
  LinearSyntenyView: 'A synteny view',
  DotplotView: 'A dotplot',
}

function comparativePlan(
  entries: Entry[],
  type: ComparativeLaunchPlan['type'],
): ComparativeLaunchPlan {
  const viewName = VIEW_NAMES[type]
  const hosted = entries.find(([key]) => key === 'genome' || key === 'config')
  if (hosted) {
    throw new Error(
      `${viewName} opens on genome files, one per row, and --${hosted[0]} names a config; pass FASTA, 2bit or .chrom.sizes files`,
    )
  }
  const data = buildComparative(entries)
  const count = data.assemblies.length
  if (type === 'DotplotView' ? count !== 2 : count < 2) {
    throw new Error(
      `${viewName} compares ${type === 'DotplotView' ? 'two genomes' : 'two genomes or more'}, and this command line names ${count}`,
    )
  }
  const used = new Set<string>()
  for (const track of data.syntenyTracks) {
    track.trackId = uniqueId(used, track.trackId)
  }
  return {
    type,
    assemblies: data.assemblies,
    views: stackedViews(data),
    tracks: data.syntenyTracks,
    view: viewSettings(givenOnce(entries, 'view') ?? []),
    unapplied: entries
      .filter(entry => !comparativeRole(entry) && entry[0] !== 'view')
      .map(entryText),
  }
}

function linearPlan(
  resolved: Entry[],
  abs: (file: string) => string,
): LinearLaunchPlan {
  const given = (key: string) => givenOnce(resolved, key)
  const one = (key: string) => given(key)?.[0]

  const genome = one('genome')
  const config = one('config')
  if (genome && config) {
    throw new Error('pass --genome or --config, not both')
  } else if (config && isUrl(config) && !/^https?:\/\//i.test(config)) {
    throw new Error(
      `--config ${config}: JBrowse fetches a config over http or https, or reads one from a file`,
    )
  }
  const configRef = genome
    ? genomeConfigUrl(genome)
    : config
      ? abs(config)
      : undefined

  const comparison = resolved.find(
    entry => comparativeRole(entry) === 'synteny',
  )
  const [genomeFile, otherGenome] = resolved.filter(
    ([key, [file = '']]) =>
      key === 'fasta' ||
      key === 'chromSizes' ||
      (key === FILE_FLAG && isSequenceAdapter(fileAdapter(file))),
  )
  const genomePath = genomeFile?.[1][0]
  if (comparison) {
    throw new Error(
      `${comparison[1][0]} compares two genomes, which a linear view does not show; open it in a synteny view`,
    )
  } else if (otherGenome) {
    throw new Error(
      `${otherGenome[1][0]} is a genome, and this view already has one; open one genome per view`,
    )
  } else if (genomePath && configRef) {
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

  const unapplied: string[] = []
  let assembly: Assembly | undefined
  if (genomeFile) {
    const built = genomeAssembly(genomeFile[0], genomeFile[1])
    assembly = built.assembly
    unapplied.push(...built.unused.map(mod => `${assembly!.name} ${mod}`))
  }
  const assemblyName = assembly?.name ?? one('assembly')

  const used = new Set<string>()
  const tracks: Track[] = []
  const show: ShowTrack[] = []
  for (const entry of resolved) {
    const [key, [first, ...mods]] = entry
    if (entry === genomeFile || key === 'loc' || key === 'view') {
      continue
    } else if (key === 'track') {
      if (!first) {
        throw new Error('--track requires a trackId')
      }
      show.push(showTrack(first, mods))
    } else if (isTrackFlag(key)) {
      const track = fileTrack(key, entry[1], assemblyName)
      track.trackId = uniqueId(used, track.trackId)
      tracks.push(track)
      show.push(showTrack(track.trackId, mods))
    } else {
      unapplied.push(...mods.map(extra => `--${key} ${extra}`))
    }
  }

  const loc = given('loc')
  return {
    type: 'LinearGenomeView',
    config: configRef,
    assembly,
    assemblyName,
    loc: loc && locValue(loc),
    view: viewSettings(given('view') ?? []),
    tracks,
    show,
    unapplied,
  }
}
