import {
  FILE_FLAG,
  isDataFile,
  isMemberWrite,
  parseArgv,
  standardizeArgv,
  trackFlags,
  viewSettings,
} from '@jbrowse/launch-args'
import { buildDisplaySnapshot } from '@jbrowse/launch-args/displaySettings'

import type { SpecTrack } from './url.ts'
import type { Entry } from '@jbrowse/launch-args'

export interface ParsedArgs {
  command: 'capture' | 'batch' | 'url' | 'list'
  genome?: string
  config?: string
  assembly?: string
  loc?: string
  /** `--track`'s, each a trackId or a trackId with the display settings its modifiers write */
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
  } else if (key === 'fasta' || (trackFlags as string[]).includes(key)) {
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

// these read the track as the page opened it: its configured value, or the
// view's center
const AFTER_OPEN = /^(sort|filterTag):/

function captureTrack(trackId: string, modifiers: string[]): SpecTrack {
  const afterOpen = modifiers.filter(
    mod => isMemberWrite(mod) || AFTER_OPEN.test(mod),
  )
  if (afterOpen.length) {
    throw new Error(
      `--track ${trackId} ${afterOpen.join(' ')}: jb2capture opens a track in one step, so it cannot write a member over the configured setting, add to the configured tags, or sort at the view's center; jb2export and JBrowse Desktop can`,
    )
  }
  let settings
  try {
    settings = buildDisplaySnapshot(undefined, modifiers)
  } catch (e) {
    throw new Error(
      `--track ${trackId}: ${e instanceof Error ? e.message : e}`,
      {
        cause: e,
      },
    )
  }
  const { snap, displayType } = settings
  const entry = { ...snap, ...(displayType ? { type: displayType } : {}) }
  return Object.keys(entry).length ? { ...entry, trackId } : trackId
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

function captureArgs(tokens: string[]) {
  const [first] = tokens
  if (first !== undefined && !first.startsWith('-') && !isDataFile(first)) {
    throw new Error(`Unexpected argument '${first}'`)
  }
  return { entries: tokenize(tokens), positionals: [] }
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
  const { entries, positionals } =
    command === 'list'
      ? listArgs(afterCommand)
      : command === 'batch'
        ? batchArgs(afterCommand)
        : captureArgs(command === 'capture' ? argv : afterCommand)
  const named = entries.map(entry => {
    const flag = checkFlag(command, entry)
    return [flag, entry[1]] satisfies Entry
  })
  const { trackList: _, ...values } = standardizeArgv(
    named.filter(([key]) => key !== 'track'),
    [],
    { repeatable: [], withModifiers: ['view'] },
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
