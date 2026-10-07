/**
 * A shorthand snapshot with its location slots filled in: `derived` supplies
 * what the shorthand implies, and any key the config spells out for itself
 * wins. The shorthand's own keys leave the result, `uri` and `baseUri` and
 * whichever others `consumed` names, since an adapter's schema is `closed`
 * and would name one left behind as undeclared.
 *
 * Spread the other way round — derived over the snapshot — a config naming both
 * a `uri` and a location that is not the sibling of it, `{ uri: 'x.fa',
 * faiLocation: { uri: 'custom.fai' } }`, silently lost the index it named to
 * the one the shorthand invents. Every adapter's normalizer had its own copy of
 * the spread, so the precedence had to be got right 30-odd times.
 */
export function fillLocations(
  snap: Record<string, unknown>,
  derived: Record<string, unknown>,
  consumed: readonly string[] = [],
) {
  const written = { ...snap }
  for (const key of ['uri', 'baseUri', ...consumed]) {
    delete written[key]
  }
  return { ...derived, ...written }
}
