import { fillLocations } from './fillLocations.ts'

/**
 * Expand a one-file adapter's shorthand — `{ uri: 'x.bed' }`, optionally with
 * `baseUri` — into the single location slot it declares, or pass a snapshot
 * already in full form through untouched.
 *
 * `locationKey` is the only thing that differs between the twenty-odd adapters
 * reading one file (`bedLocation`, `bigWigLocation`, `hicLocation`,
 * `pafLocation`, …), and each was writing the same eight lines out for it. The
 * indexed families have {@link expandTabixShorthand} for the same reason.
 */
export function expandUriShorthand(
  snap: Record<string, unknown>,
  locationKey: string,
) {
  return snap.uri
    ? fillLocations(snap, {
        [locationKey]: { uri: snap.uri, baseUri: snap.baseUri },
      })
    : snap
}
