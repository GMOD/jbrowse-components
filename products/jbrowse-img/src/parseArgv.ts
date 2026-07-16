export type Entry = [string, string[]]

// A `-`-prefixed token opens a new entry; the values that follow accumulate
// onto it until the next flag. `--key=value` is equivalent to `--key value`: the
// inline value seeds the entry, so `--width=1000` no longer silently becomes an
// unknown `width=1000` option.
export function parseArgv(rawArgv: string[]) {
  const entries: Entry[] = []
  let current: string[] | undefined
  for (const arg of rawArgv) {
    if (arg.startsWith('-')) {
      const eq = arg.indexOf('=')
      current = []
      if (eq === -1) {
        entries.push([arg.slice(2), current])
      } else {
        entries.push([arg.slice(2, eq), current])
        current.push(arg.slice(eq + 1))
      }
    } else {
      current?.push(arg)
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
    if (trackTypes.includes(key)) {
      trackList.push([key, vals])
    } else {
      rest[key] = vals[0] ?? true
    }
  }
  return { trackList, ...rest }
}
