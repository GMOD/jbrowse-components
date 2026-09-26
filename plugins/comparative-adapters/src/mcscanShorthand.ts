import { fillLocations } from '@jbrowse/core/configuration'

/**
 * The one-line shorthand both MCScan adapters accept: `uri` becomes the anchors
 * slot, `bed1`/`bed2` the two BEDs the anchors file needs to place a gene at all.
 *
 * Each key expands independently. Gating all three on each other expanded none
 * of them when one was missing, which left the slots at their `/path/to`
 * defaults and drew an empty track; the config now reports the file it lacks.
 * `scripts/generateConfigManifest.ts` probes one key at a time, so it is also
 * what keeps these two adapters' accepted-key list from widening to every
 * candidate.
 */
export function expandMcscanShorthand(
  snap: Record<string, unknown>,
  anchorsKey: string,
) {
  const { uri, bed1, bed2, baseUri } = snap
  return uri || bed1 || bed2
    ? fillLocations(snap, {
        ...(uri ? { [anchorsKey]: { uri, baseUri } } : {}),
        ...(bed1 ? { bed1Location: { uri: bed1, baseUri } } : {}),
        ...(bed2 ? { bed2Location: { uri: bed2, baseUri } } : {}),
      })
    : snap
}
