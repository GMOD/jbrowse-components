import { fileNameOf, matchFormat } from '@jbrowse/add-track-core'

export type Entry = [string, string[]]

/**
 * The flag a bare data file stands for: `reads.bam` reads as `--file
 * reads.bam`, a file typed by its name.
 */
export const FILE_FLAG = 'file'

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const DRIVE_LETTER = /^[a-z]:[\\/]/i
const MODIFIER = /^[a-z_][\w.-]*[:=]/i

/**
 * A `name:value` or `path=value` modifier, or a JSON one. A URL and a Windows
 * path carry a colon too, which is why the name before it has to be more than
 * a drive letter and cannot open a `://`.
 */
export function isModifier(token: string) {
  return (
    token.startsWith('{') ||
    (MODIFIER.test(token) &&
      !URL_SCHEME.test(token) &&
      !DRIVE_LETTER.test(token))
  )
}

/**
 * A file the shared format table recognizes by name, as a local path or a URL:
 * the one kind of bare token that is an argument on its own.
 */
export function isDataFile(token: string) {
  const entry = matchFormat(fileNameOf(token))
  return !!entry && entry.spec.kind !== 'unsupported'
}

/**
 * Split a command line into `[flag, values]` entries, in order.
 *
 * - A `-`-prefixed token opens an entry, and `--key=value` seeds it with
 *   `value`. A bare `-` is stdin, so it is a value.
 * - The token after a flag is its value, except after a flag in `booleans`,
 *   which takes only `true` or `false`.
 * - Later tokens are the entry's modifiers (`height:100`, `color.field=tags.HP`,
 *   `{"json":1}`), until a token that names a data file, which opens a
 *   {@link FILE_FLAG} entry of its own. So `--loc chr1:1-100 reads.bam` keeps
 *   both, and `reads.bam height:100` gives the file its modifier.
 * - A bare token before any flag that is not a data file throws; it used to be
 *   dropped without a word.
 */
export function parseArgv(
  rawArgv: string[],
  { booleans = new Set<string>() }: { booleans?: ReadonlySet<string> } = {},
) {
  const entries: Entry[] = []
  let current: string[] | undefined
  let isBoolean = false
  for (const arg of rawArgv) {
    // a boolean flag with no value yet takes nothing but true/false
    const takesValues =
      !isBoolean || !!current?.length || arg === 'true' || arg === 'false'
    if (arg.startsWith('-') && arg !== '-') {
      const eq = arg.indexOf('=')
      const key = (eq === -1 ? arg : arg.slice(0, eq)).replace(/^-+/, '')
      current = eq === -1 ? [] : [arg.slice(eq + 1)]
      entries.push([key, current])
      isBoolean = booleans.has(key)
    } else if (
      current &&
      takesValues &&
      (current.length === 0 || isModifier(arg))
    ) {
      current.push(arg)
    } else if (isDataFile(arg)) {
      current = [arg]
      entries.push([FILE_FLAG, current])
      isBoolean = false
    } else if (current && takesValues) {
      current.push(arg)
    } else {
      throw new Error(
        `Unexpected argument "${arg}": not a flag, a modifier, or a data file JBrowse recognizes by name. Name its type with a flag such as --bam or --bigwig`,
      )
    }
  }
  return entries
}

// Split a `key:value` modifier token at its FIRST colon, keeping any colons in
// the value (URLs, locstrings — e.g. `aliases:https://x/a.txt`). Returns
// undefined for a token with no colon or a leading colon. This is the
// colon-preserving grammar the assembly-flag (`loc:`/`aliases:`) and track-file
// (`index:`/`name:`) modifiers use; the display modifiers instead split every
// colon (`color:tag:XS`) directly where they're parsed.
export function splitModifier(token: string): [string, string] | undefined {
  const i = token.indexOf(':')
  return i > 0 ? [token.slice(0, i), token.slice(i + 1)] : undefined
}

// The value of the first `key:value` modifier in `tokens` matching `key`.
export function modifierValue(tokens: string[], key: string) {
  for (const token of tokens) {
    const split = splitModifier(token)
    if (split?.[0] === key) {
      return split[1]
    }
  }
  return undefined
}

export function standardizeArgv(
  args: Entry[],
  trackTypes: string[],
): { trackList: Entry[]; [key: string]: unknown } {
  const trackList: Entry[] = []
  const rest: Record<string, unknown> = {}
  for (const [key, vals] of args) {
    if (key === FILE_FLAG || trackTypes.includes(key)) {
      trackList.push([key, vals])
    } else {
      rest[key] = vals[0] ?? true
    }
  }
  return { trackList, ...rest }
}
