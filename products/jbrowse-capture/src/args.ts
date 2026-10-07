import { parseArgs as parseNodeArgs } from 'node:util'

import type { ParseArgsOptionsConfig } from 'node:util'

export interface ParsedArgs {
  command: 'capture' | 'batch' | 'url' | 'list'
  hub?: string
  config?: string
  assembly?: string
  loc?: string
  tracks: string[]
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
  /** `list`'s hub and filter, or `batch`'s manifest. Empty for the other commands. */
  positionals: string[]
}

// flags spelled as the library's option names, so a script and a command line
// say the same thing
const OPTIONS = {
  hub: { type: 'string' },
  config: { type: 'string' },
  assembly: { type: 'string' },
  loc: { type: 'string' },
  spec: { type: 'string' },
  session: { type: 'string' },
  instance: { type: 'string' },
  out: { type: 'string', short: 'o' },
  track: { type: 'string', multiple: true, default: [] as string[] },
  width: { type: 'string' },
  height: { type: 'string' },
  dpr: { type: 'string' },
  timeout: { type: 'string' },
  concurrency: { type: 'string' },
  fullPage: { type: 'boolean', default: false },
  annotations: { type: 'string' },
  headed: { type: 'boolean', default: false },
  verbose: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
  allowUnsettled: { type: 'boolean', default: false },
} satisfies ParseArgsOptionsConfig

type Flag = keyof typeof OPTIONS

const EVERY_COMMAND: Flag[] = ['help', 'version']

const SUBCOMMAND_FLAGS: Record<ParsedArgs['command'], Set<string>> = {
  capture: new Set(
    (Object.keys(OPTIONS) as Flag[]).filter(f => f !== 'concurrency'),
  ),
  batch: new Set((Object.keys(OPTIONS) as Flag[]).filter(f => f !== 'out')),
  url: new Set<Flag>([
    'hub',
    'config',
    'assembly',
    'loc',
    'track',
    'spec',
    'session',
    'instance',
    ...EVERY_COMMAND,
  ]),
  list: new Set<Flag>(EVERY_COMMAND),
}

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

/**
 * Parse a `jb2capture` command line. Strict: an unknown flag, a flag the
 * command does not use, and a bare word anywhere but after `list` are errors
 * rather than silently ignored.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [first, ...afterCommand] = argv
  const command =
    first === 'list' || first === 'url' || first === 'batch' ? first : 'capture'
  const { values, positionals, tokens } = parseNodeArgs({
    args: command === 'capture' ? argv : afterCommand,
    options: OPTIONS,
    allowPositionals: command === 'list' || command === 'batch',
    tokens: true,
  })
  for (const token of tokens) {
    if (token.kind === 'option' && !SUBCOMMAND_FLAGS[command].has(token.name)) {
      throw new Error(
        command === 'capture'
          ? `${token.rawName} applies only to \`jb2capture batch\``
          : `${token.rawName} does not apply to \`jb2capture ${command}\``,
      )
    }
  }
  const fromStdin = (['spec', 'session', 'annotations'] as const).filter(
    flag => values[flag] === '-',
  )
  if (fromStdin.length > 1) {
    throw new Error(
      `${fromStdin.map(f => `--${f}`).join(' and ')} cannot both read stdin (-)`,
    )
  }
  const { track, width, height, dpr, timeout, concurrency, ...rest } = values
  return {
    ...rest,
    command,
    // copied, since node hands back the option table's own default array
    tracks: [...track],
    width: positiveInt('width', width),
    height: positiveInt('height', height),
    dpr: positive('dpr', dpr),
    timeout: positive('timeout', timeout),
    concurrency: positiveInt('concurrency', concurrency),
    positionals,
  }
}
