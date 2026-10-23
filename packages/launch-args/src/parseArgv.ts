import { fileNameOf, matchFormat } from '@jbrowse/add-track-core'

export type Entry = [string, string[]]

/**
 * The flag a bare data file stands for: `reads.bam` reads as `--file
 * reads.bam`, a file typed by its name.
 */
export const FILE_FLAG = 'file'

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/** Whether a command-line file is a URL (http, s3, ftp, …) rather than a path. */
export function isUrl(file: string) {
  return URL_SCHEME.test(file)
}
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
    (MODIFIER.test(token) && !isUrl(token) && !DRIVE_LETTER.test(token))
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

// `key:value` split at the first colon, so `aliases:https://x/a.txt` keeps its
// URL. The display modifiers split every colon instead (`color:tag:XS`).
export function splitModifier(token: string): [string, string] | undefined {
  const i = token.indexOf(':')
  return i > 0 ? [token.slice(0, i), token.slice(i + 1)] : undefined
}

/**
 * The value of a `key:value` modifier in `tokens`. The last one given wins, as
 * with the display modifiers, so a script overrides a shared list by
 * appending to it.
 */
export function modifierValue(tokens: string[], key: string) {
  return tokens.map(splitModifier).findLast(split => split?.[0] === key)?.[1]
}

/** `--loc`'s tokens, which together name the regions of one view. */
export function locValue(values: string[]) {
  return values.join(' ').trim() || undefined
}

/**
 * Words a flag's value is followed by, read off as one error: a flag that
 * takes one value has no use for them.
 */
export function extraValuesMessage(flag: string, extra: string[]) {
  return `--${flag} takes one value, so ${extra.map(e => `"${e}"`).join(' ')} ${extra.length > 1 ? 'apply' : 'applies'} to nothing`
}

/**
 * The command line as option values, with the track entries apart, in order.
 *
 * - `--loc` takes all its tokens, so `--loc chr1:1-100 chr2:1-100` names the
 *   regions a quoted `--loc` does.
 * - A flag in `repeatable` may repeat and so has no single value here; the
 *   caller reads it from the entries.
 * - A flag in `withModifiers` takes modifiers after its value, which the
 *   caller reads from the entries too.
 * - Any other flag given twice, or followed by a token it has no use for,
 *   throws.
 */
export function standardizeArgv(
  args: Entry[],
  trackTypes: string[],
  {
    repeatable = ['track'],
    withModifiers = ['track', 'view', 'fasta', 'chromSizes'],
  }: { repeatable?: string[]; withModifiers?: string[] } = {},
): { trackList: Entry[]; [key: string]: unknown } {
  const trackList: Entry[] = []
  const rest: Record<string, unknown> = {}
  for (const [key, vals] of args) {
    if (key === FILE_FLAG || trackTypes.includes(key)) {
      trackList.push([key, vals])
    } else if (repeatable.includes(key)) {
      continue
    } else if (Object.hasOwn(rest, key)) {
      throw new Error(`--${key} is given more than once`)
    } else if (key === 'loc') {
      rest[key] = locValue(vals) ?? true
    } else {
      const [value, ...extra] = vals
      if (extra.length && !withModifiers.includes(key)) {
        throw new Error(extraValuesMessage(key, extra))
      }
      rest[key] = value ?? true
    }
  }
  return { trackList, ...rest }
}
