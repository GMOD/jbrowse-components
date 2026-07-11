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
