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

// One kind per option, in one place. The kinds used to be six parallel Sets
// with a `known()` union over them, where `width` was spelled in three of them
// and a name added to POSITIVE but not NUMERIC silently became a string.
type OptionKind = 'flag' | 'string' | 'repeatable' | 'positive' | 'nonNegative'

// `--fullPage`, not `--full-page`: the flags match the option names in the
// library API one for one, so a script and a command line say the same thing.
const OPTIONS: Record<string, OptionKind> = {
  hub: 'string',
  config: 'string',
  assembly: 'string',
  loc: 'string',
  session: 'string',
  sessionName: 'string',
  instance: 'string',
  out: 'string',
  track: 'repeatable',
  width: 'positive',
  height: 'positive',
  scale: 'positive',
  timeout: 'positive',
  settle: 'nonNegative',
  fullPage: 'flag',
  headed: 'flag',
  verbose: 'flag',
  help: 'flag',
  allowUnsettled: 'flag',
}

// Aliases are the two abbreviations that are hard not to type.
const ALIASES: Record<string, string> = { o: 'out', h: 'help' }

// `Object.hasOwn`, not a bare lookup: `--constructor` and `--toString` are
// inherited keys, so an unguarded read finds a function and the flag stops
// being unknown.
function kindOf(name: string): OptionKind | undefined {
  return Object.hasOwn(OPTIONS, name) ? OPTIONS[name] : undefined
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
  for (const [name, kind] of Object.entries(OPTIONS)) {
    if (kind === 'flag') {
      out[name] = false
    }
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
    const kind = kindOf(name)
    if (!kind) {
      throw new Error(`unknown flag "${arg}"`)
    }
    if (kind === 'flag') {
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
    if (kind === 'repeatable') {
      ;(out.tracks as string[]).push(value)
    } else if (kind === 'string') {
      out[name] = value
    } else {
      const n = Number(value)
      if (!Number.isFinite(n)) {
        throw new Error(`--${name} needs a number, got "${value}"`)
      }
      // Otherwise these fail much later and elsewhere: a zero size inside
      // puppeteer, naming neither the flag nor the value, and `--timeout 0` as
      // no timeout at all there while the node-polled waits read it as expired.
      if (kind === 'positive' && n <= 0) {
        throw new Error(`--${name} needs a positive number, got "${value}"`)
      }
      if (kind === 'nonNegative' && n < 0) {
        throw new Error(
          `--${name} needs a number of milliseconds that is zero or more, got "${value}"`,
        )
      }
      out[name] = n
    }
  }
  return out as unknown as ParsedArgs
}
