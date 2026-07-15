function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

export function parseError(str: string) {
  let snapshotValue: unknown
  let message = ''
  const match =
    /(?:at path "([^"]*)" )?snapshot `([^`]*)` is not assignable/.exec(str)
  if (match) {
    snapshotValue = tryParseJson(match[2]!)
    message = match[1] ? `Snapshot at path "${match[1]}":` : 'Snapshot:'
  }
  return { snapshotValue, message }
}
