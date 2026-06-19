export type Entry = [string, string[]]

// A `-`-prefixed token opens a new entry; the values that follow accumulate
// onto it until the next flag.
export function parseArgv(rawArgv: string[]) {
  const entries: Entry[] = []
  let current: string[] | undefined
  for (const arg of rawArgv) {
    if (arg.startsWith('-')) {
      current = []
      entries.push([arg.slice(2), current])
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
