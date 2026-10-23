import {
  FILE_FLAG,
  buildComparative,
  hasComparativeArgs,
  isDataFile,
  launchViewType,
  parseArgv,
  standardizeArgv,
  takesFile,
  viewSettings,
} from '@jbrowse/launch-args'
import { checkModifiers } from '@jbrowse/launch-args/displaySettings'

import type { HostedComparative } from './hostedComparative.ts'
import type { SpecTrack } from './url.ts'
import type { Entry, LaunchViewType } from '@jbrowse/launch-args'

export interface ParsedArgs {
  command: 'capture' | 'batch' | 'url' | 'list'
  genome?: string
  /** a synteny view or dotplot, whose `--genome`s are its rows */
  comparative?: HostedComparative
  config?: string
  assembly?: string
  loc?: string
  /** `--track`'s, each a trackId or a trackId with its modifiers */
  tracks: SpecTrack[]
  /** settings `--view` writes on the view, as a session spec's view holds them */
  view: Record<string, unknown>
  spec?: string
  session?: string
  instance?: string
  out?: string
  width?: number
  height?: number
  dpr?: number
  timeout?: number
  concurrency?: number
  fullPage: boolean
  annotations?: string
  headed: boolean
  verbose: boolean
  help: boolean
  version: boolean
  allowUnsettled: boolean
  /** `list`'s genome and filter, or `batch`'s manifest. Empty for the other commands. */
  positionals: string[]
}

const STRINGS = [
  'genome',
  'config',
  'assembly',
  'loc',
  'spec',
  'session',
  'instance',
  'out',
  'track',
  'view',
  'width',
  'height',
  'dpr',
  'timeout',
  'concurrency',
  'annotations',
] as const

const BOOLEANS = [
  'fullPage',
  'headed',
  'verbose',
  'help',
  'version',
  'allowUnsettled',
] as const

type Flag = (typeof STRINGS)[number] | (typeof BOOLEANS)[number]

const FLAGS = new Set<string>([...STRINGS, ...BOOLEANS])
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(BOOLEANS)
const SHORT: Record<string, Flag> = { o: 'out', h: 'help', v: 'version' }

const EVERY_COMMAND: Flag[] = ['help', 'version']

const SUBCOMMAND_FLAGS: Record<ParsedArgs['command'], Set<string>> = {
  capture: new Set([...FLAGS].filter(f => f !== 'concurrency')),
  batch: new Set([...FLAGS].filter(f => f !== 'out')),
  url: new Set<Flag>([
    'genome',
    'config',
    'assembly',
    'loc',
    'track',
    'view',
    'spec',
    'session',
    'instance',
    ...EVERY_COMMAND,
  ]),
  list: new Set<Flag>(EVERY_COMMAND),
}

const DATA_FILE_HINT =
  'jb2capture opens the tracks a config lists and cannot serve a data file to its browser. ' +
  'Draw it with jb2export, or open it in JBrowse Desktop, which take the same command line'

function finite(name: string, raw: string | undefined) {
  if (raw === undefined) {
    return undefined
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    throw new Error(`--${name} needs a number, got "${raw}"`)
  }
  return n
}

function positiveInt(name: string, raw: string | undefined) {
  const n = positive(name, raw)
  if (n !== undefined && !Number.isInteger(n)) {
    throw new Error(`--${name} needs a whole number, got "${raw}"`)
  }
  return n
}

function positive(name: string, raw: string | undefined) {
  const n = finite(name, raw)
  if (n !== undefined && n <= 0) {
    throw new Error(`--${name} needs a positive number, got "${raw}"`)
  }
  return n
}

const rawName = (key: string) => (key.length === 1 ? `-${key}` : `--${key}`)

// a key no capture reads, or one this command does not use; a data file or a
// track-file flag is jb2export's and Desktop's
function checkFlag(command: ParsedArgs['command'], [key, values]: Entry) {
  if (key === FILE_FLAG) {
    throw new Error(`${values[0]} is a data file. ${DATA_FILE_HINT}`)
  } else if (takesFile(key)) {
    throw new Error(`--${key} opens a data file. ${DATA_FILE_HINT}`)
  }
  const flag = SHORT[key] ?? key
  if (!FLAGS.has(flag)) {
    throw new Error(`Unknown option '${rawName(key)}'`)
  } else if (!SUBCOMMAND_FLAGS[command].has(flag)) {
    throw new Error(
      command === 'capture'
        ? `${rawName(key)} applies only to \`jb2capture batch\``
        : `${rawName(key)} does not apply to \`jb2capture ${command}\``,
    )
  } else if (!BOOLEAN_FLAGS.has(flag) && !values.length) {
    throw new Error(
      `${rawName(key)} needs a value; write one that starts with a dash as ${rawName(key)}=<value>`,
    )
  }
  return flag
}

// the page applies the modifiers as it opens the track, so a bad one fails here
function captureTrack(trackId: string, modifiers: string[]): SpecTrack {
  try {
    checkModifiers(modifiers)
  } catch (e) {
    throw new Error(
      `--track ${trackId}: ${e instanceof Error ? e.message : e}`,
      {
        cause: e,
      },
    )
  }
  return modifiers.length ? { trackId, modifiers } : trackId
}

function listArgs(tokens: string[]) {
  const entries: Entry[] = []
  const positionals: string[] = []
  for (const token of tokens) {
    if (token.startsWith('-') && token !== '-') {
      entries.push([token.replace(/^-+/, ''), []])
    } else {
      positionals.push(token)
    }
  }
  return { entries, positionals }
}

const tokenize = (tokens: string[]) =>
  parseArgv(tokens, { booleans: BOOLEAN_FLAGS })

// batch's manifest comes right after the word, so the flags after it read as
// a capture's
function batchArgs(tokens: string[]) {
  const [first, ...rest] = tokens
  return first === '-' || (first !== undefined && !first.startsWith('-'))
    ? { entries: tokenize(rest), positionals: [first] }
    : { entries: tokenize(tokens), positionals: [] }
}

// a view word first (`synteny`, `dotplot`, `lgv`) picks the view, as in
// jb2export and Desktop
function captureArgs(tokens: string[]) {
  const [first, ...rest] = tokens
  const viewType = first === undefined ? undefined : launchViewType(first)
  if (viewType) {
    return { entries: tokenize(rest), positionals: [], viewType }
  }
  if (first !== undefined && !first.startsWith('-') && !isDataFile(first)) {
    throw new Error(`Unexpected argument '${first}'`)
  }
  return { entries: tokenize(tokens), positionals: [] }
}

// The rows of a synteny view or dotplot: the view a word named, or a synteny
// view for a line naming a second genome.
function hostedComparativeOf(
  named: Entry[],
  viewType: LaunchViewType | undefined,
): HostedComparative | undefined {
  const type =
    viewType ?? (hasComparativeArgs(named) ? 'LinearSyntenyView' : undefined)
  if (type === undefined || type === 'LinearGenomeView') {
    return undefined
  }
  const { rows, hosted } = buildComparative(named)
  if (type === 'DotplotView' ? rows.length !== 2 : rows.length < 2) {
    throw new Error(
      `${type === 'DotplotView' ? 'a dotplot compares two genomes' : 'a synteny view compares two genomes or more'}, and this command line names ${rows.length}; give one --genome per row`,
    )
  }
  return { type, rows, hosted }
}

/**
 * Parse a `jb2capture` command line, in the grammar jb2export and JBrowse
 * Desktop read (`@jbrowse/launch-args`): `--track id height:200` writes display
 * settings, `--view axis.grid=false` view settings, and `--loc` takes several
 * regions. Strict: an unknown flag, a flag the command does not use, a repeated
 * flag, a stray word and a data file are errors rather than silently ignored.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [word, ...afterCommand] = argv
  const command =
    word === 'list' || word === 'url' || word === 'batch' ? word : 'capture'
  const {
    entries,
    positionals,
    viewType,
  }: { entries: Entry[]; positionals: string[]; viewType?: LaunchViewType } =
    command === 'list'
      ? listArgs(afterCommand)
      : command === 'batch'
        ? batchArgs(afterCommand)
        : captureArgs(command === 'capture' ? argv : afterCommand)
  const named = entries.map(entry => {
    const flag = checkFlag(command, entry)
    return [flag, entry[1]] satisfies Entry
  })
  const comparative = hostedComparativeOf(named, viewType)
  const { trackList: _, ...values } = standardizeArgv(
    named.filter(([key]) => key !== 'track'),
    [],
    { repeatable: comparative ? ['genome'] : [], withModifiers: ['view'] },
  )
  const string = (flag: (typeof STRINGS)[number]) =>
    values[flag] as string | undefined
  const bool = (flag: (typeof BOOLEANS)[number]) => {
    const value = values[flag]
    if (
      value !== undefined &&
      value !== true &&
      value !== 'true' &&
      value !== 'false'
    ) {
      throw new Error(`--${flag} takes true or false, got "${value}"`)
    }
    return value === true || value === 'true'
  }
  const fromStdin = (['spec', 'session', 'annotations'] as const).filter(
    flag => string(flag) === '-',
  )
  if (fromStdin.length > 1) {
    throw new Error(
      `${fromStdin.map(f => `--${f}`).join(' and ')} cannot both read stdin (-)`,
    )
  }
  return {
    command,
    genome: string('genome'),
    comparative,
    config: string('config'),
    assembly: string('assembly'),
    loc: string('loc'),
    tracks: named
      .filter(([key]) => key === 'track')
      .map(([, [trackId = '', ...modifiers]]) =>
        captureTrack(trackId, modifiers),
      ),
    view: viewSettings(named.find(([key]) => key === 'view')?.[1] ?? []),
    spec: string('spec'),
    session: string('session'),
    instance: string('instance'),
    out: string('out'),
    annotations: string('annotations'),
    width: positiveInt('width', string('width')),
    height: positiveInt('height', string('height')),
    dpr: positive('dpr', string('dpr')),
    timeout: positive('timeout', string('timeout')),
    concurrency: positiveInt('concurrency', string('concurrency')),
    fullPage: bool('fullPage'),
    headed: bool('headed'),
    verbose: bool('verbose'),
    help: bool('help'),
    version: bool('version'),
    allowUnsettled: bool('allowUnsettled'),
    positionals,
  }
}
