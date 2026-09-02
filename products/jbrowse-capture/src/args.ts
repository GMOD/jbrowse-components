export interface ParsedArgs {
  hub?: string
  config?: string
  assembly?: string
  loc?: string
  tracks: string[]
  session?: string
  sessionName?: string
  instance?: string
  out?: string
  width?: number
  height?: number
  scale?: number
  timeout?: number
  settle?: number
  fullPage: boolean
  headed: boolean
  verbose: boolean
  help: boolean
  allowUnsettled: boolean
}

const NUMERIC = new Set(['width', 'height', 'scale', 'timeout', 'settle'])
const POSITIVE = new Set(['width', 'height', 'scale'])
const FLAGS = new Set([
  'fullPage',
  'headed',
  'verbose',
  'help',
  'allowUnsettled',
])
const REPEATABLE = new Set(['track'])
const STRINGS = new Set([
  'hub',
  'config',
  'assembly',
  'loc',
  'session',
  'sessionName',
  'instance',
  'out',
])

// `--fullPage`, not `--full-page`: the flags match the option names in the
// library API one for one, so a script and a command line say the same thing.
// Aliases are the two abbreviations that are hard not to type.
const ALIASES: Record<string, string> = { o: 'out', h: 'help' }

function known(name: string) {
  return (
    NUMERIC.has(name) ||
    FLAGS.has(name) ||
    REPEATABLE.has(name) ||
    STRINGS.has(name)
  )
}

/**
 * Parse `jb2capture` flags. Split from the binary so the accepted shapes are
 * unit-testable without launching a browser.
 *
 * Unknown flags throw rather than being ignored: a mistyped `--tracks` on a tool
 * whose whole job is to produce a plausible-looking image would otherwise be
 * reported by nothing at all.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const out: Record<string, unknown> = { tracks: [] }
  for (const flag of FLAGS) {
    out[flag] = false
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (!arg.startsWith('-')) {
      throw new Error(`unexpected argument "${arg}"`)
    }
    const bare = arg.replace(/^--?/, '')
    const eq = bare.indexOf('=')
    const rawName = eq === -1 ? bare : bare.slice(0, eq)
    const name = ALIASES[rawName] ?? rawName
    if (!known(name)) {
      throw new Error(`unknown flag "${arg}"`)
    }
    if (FLAGS.has(name)) {
      // `--fullPage=false` used to set the flag true, silently.
      if (eq !== -1) {
        throw new Error(
          `--${name} is a flag and takes no value; omit it to leave it off`,
        )
      }
      out[name] = true
      continue
    }
    const value = eq === -1 ? argv[++i] : bare.slice(eq + 1)
    if (value === undefined) {
      throw new Error(`--${name} needs a value`)
    }
    if (REPEATABLE.has(name)) {
      ;(out.tracks as string[]).push(value)
    } else if (NUMERIC.has(name)) {
      const n = Number(value)
      if (!Number.isFinite(n)) {
        throw new Error(`--${name} needs a number, got "${value}"`)
      }
      // A zero-size viewport or scale otherwise fails much later, inside
      // puppeteer, with an error naming neither the flag nor the value.
      if (POSITIVE.has(name) && n <= 0) {
        throw new Error(`--${name} needs a positive number, got "${value}"`)
      }
      out[name] = n
    } else {
      out[name] = value
    }
  }
  return out as unknown as ParsedArgs
}
