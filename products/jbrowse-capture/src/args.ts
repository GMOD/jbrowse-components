import { parseArgs as parseNodeArgs } from 'node:util'

import type { ParseArgsOptionsConfig } from 'node:util'

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
  /** What `list` reads its hub and filter from. Empty for every other form. */
  positionals: string[]
}

// `--fullPage`, not `--full-page`: the flags match the option names in the
// library API one for one, so a script and a command line say the same thing.
// Aliases are the two abbreviations that are hard not to type.
const OPTIONS = {
  hub: { type: 'string' },
  config: { type: 'string' },
  assembly: { type: 'string' },
  loc: { type: 'string' },
  session: { type: 'string' },
  sessionName: { type: 'string' },
  instance: { type: 'string' },
  out: { type: 'string', short: 'o' },
  track: { type: 'string', multiple: true, default: [] as string[] },
  width: { type: 'string' },
  height: { type: 'string' },
  scale: { type: 'string' },
  timeout: { type: 'string' },
  settle: { type: 'string' },
  fullPage: { type: 'boolean', default: false },
  headed: { type: 'boolean', default: false },
  verbose: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  allowUnsettled: { type: 'boolean', default: false },
} satisfies ParseArgsOptionsConfig

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

// node:util parses every value as a string, and these two checks are the ones
// it cannot make. Without them they fail much later and elsewhere: a zero size
// inside puppeteer, naming neither the flag nor the value, and `--timeout 0` as
// no timeout at all there while the node-polled waits read it as expired.
function positive(name: string, raw: string | undefined) {
  const n = finite(name, raw)
  if (n !== undefined && n <= 0) {
    throw new Error(`--${name} needs a positive number, got "${raw}"`)
  }
  return n
}

function milliseconds(name: string, raw: string | undefined) {
  const n = finite(name, raw)
  if (n !== undefined && n < 0) {
    throw new Error(
      `--${name} needs a number of milliseconds that is zero or more, got "${raw}"`,
    )
  }
  return n
}

/**
 * Parse `jb2capture` flags. Split from the binary so the accepted shapes are
 * unit-testable without launching a browser.
 *
 * `node:util`'s parser in strict mode, which rejects an unknown flag rather
 * than ignoring it: a mistyped `--tracks` on a tool whose whole job is to
 * produce a plausible-looking image would otherwise be reported by nothing at
 * all. It also rejects `--fullPage=false`, which used to set the flag true.
 *
 * `allowPositionals` is for `list`, the one form that takes bare words. Left
 * off, a stray `foo.png` is an error rather than a silently ignored argument —
 * and node's unknown-flag message stays free of the advice about `--` that only
 * applies to a command with positionals.
 */
export function parseArgs(
  argv: string[],
  { allowPositionals = false }: { allowPositionals?: boolean } = {},
): ParsedArgs {
  const { values, positionals } = parseNodeArgs({
    args: argv,
    options: OPTIONS,
    allowPositionals,
  })
  const { track, width, height, scale, timeout, settle, ...rest } = values
  return {
    ...rest,
    // Copied: with no `--track`, node hands back the `default: []` array off
    // OPTIONS itself, so every call shares one instance and a caller that
    // pushes to it edits the module constant.
    tracks: [...track],
    width: positive('width', width),
    height: positive('height', height),
    scale: positive('scale', scale),
    timeout: positive('timeout', timeout),
    settle: milliseconds('settle', settle),
    positionals,
  }
}
