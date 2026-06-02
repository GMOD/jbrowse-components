export type Entry = [string, string[]]

export function parseArgv(rawArgv: string[]) {
  const map: Entry[] = []
  let argv = rawArgv
  while (argv.length) {
    const val = argv[0]!.slice(2)
    argv = argv.slice(1)
    const next = argv.findIndex(arg => arg.startsWith('-'))

    if (next !== -1) {
      map.push([val, argv.slice(0, next)])
      argv = argv.slice(next)
    } else {
      map.push([val, argv])
      break
    }
  }
  return map
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
