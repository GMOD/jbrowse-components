import { fillLocations } from './fillLocations.ts'

/**
 * Expand a one-file adapter's `{ uri }` shorthand into the single location slot
 * it declares, or pass a snapshot already in full form through untouched.
 *
 * `locationKey` is the only thing that differs between the twenty-odd adapters
 * reading one file (`bedLocation`, `bigWigLocation`, `hicLocation`,
 * `pafLocation`, …). `expandTabixShorthand` is the indexed families' version.
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
