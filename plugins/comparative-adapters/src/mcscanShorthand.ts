import { fillLocations } from '@jbrowse/core/configuration'

/**
 * The one-line shorthand both MCScan adapters accept: `uri` becomes the anchors
 * slot, and `bed1`/`bed2` the two BEDs the anchors file needs to place a gene at
 * all.
 *
 * Each key expands on its own. Requiring all three together meant a config
 * naming only some of them expanded *none*, so `{ type, uri }` left the anchors
 * slot at its `/path/to/mcscan.anchors` default and drew an empty track — and
 * `jbrowse validate` called that config fine, because the manifest derives an
 * adapter's accepted shorthand keys by running this and seeing what it derived.
 * A key left out now reports the file it is missing instead.
 *
 * That also narrows what the manifest claims: an all-or-nothing normalizer fired
 * for no single probe key, so the generator fell back to accepting every
 * remaining candidate at once and these two adapters advertised `htsgetBase`,
 * `nhUri` and `chromSizes` as their own shorthands.
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
