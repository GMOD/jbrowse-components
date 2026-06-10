export interface PastedTrackConf {
  trackId: string
  type: string
  name?: string
  assemblyNames?: string[]
}

function asTrackConf(value: unknown, label: string): PastedTrackConf {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Track config${label} must be a JSON object`)
  }
  const { trackId, type } = value as Record<string, unknown>
  if (typeof trackId !== 'string' || !trackId) {
    throw new Error(`Track config${label} is missing a "trackId" string`)
  }
  if (typeof type !== 'string' || !type) {
    throw new Error(`Track config${label} is missing a "type" string`)
  }
  return value as PastedTrackConf
}

/**
 * Parses pasted JSON into one or more track configs, with friendly errors for
 * the structural problems `addTrackConf` reports poorly (empty input, non-object
 * entries, bad JSON). Per-config validity (e.g. a bad adapter) is left to
 * `addTrackConf`, which surfaces its own message.
 */
export function parseTrackConfigs(jsonText: string): PastedTrackConf[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (e) {
    throw new Error(`Could not parse JSON: ${String(e)}`, { cause: e })
  }
  const list = Array.isArray(parsed) ? parsed : [parsed]
  if (list.length === 0) {
    throw new Error('No track configuration found in the pasted text')
  }
  return list.map((conf, i) =>
    asTrackConf(conf, list.length > 1 ? ` at index ${i}` : ''),
  )
}
