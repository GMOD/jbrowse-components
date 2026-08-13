/**
 * The `index` half of a tabix-indexed adapter's shorthand snapshot: given
 * `{ uri, baseUri?, csi? }`, where the index file sits and what kind it is.
 *
 * Two spellings of the same flag have to agree — `CSI`/`TBI` names the type and
 * `.csi`/`.tbi` the file extension — and eight adapters were each writing both
 * out. Getting the pair crossed is an adapter that looks for the wrong index
 * file, or claims the wrong format for the right one, on a config the user
 * wrote correctly.
 */
export function tabixIndexSnapshot(snap: Record<string, unknown>) {
  const csi = Boolean(snap.csi)
  return {
    indexType: csi ? 'CSI' : 'TBI',
    location: {
      uri: `${snap.uri}.${csi ? 'csi' : 'tbi'}`,
      baseUri: snap.baseUri,
    },
  }
}

/**
 * Expand a tabix adapter's one-line shorthand — `{ uri: 'x.gff.gz' }`, plus
 * optional `csi` — into the full `{ <locationKey>, index }` snapshot, or pass a
 * snapshot that is already in full form through untouched.
 *
 * `locationKey` is the only thing that differs between adapters
 * (`gffGzLocation`, `vcfGzLocation`, `bedGzLocation`, `pifGzLocation`, …), so
 * it is the only thing they now supply. An adapter whose shorthand carries more
 * than this (maf's `nhUri`) composes `tabixIndexSnapshot` directly instead.
 *
 * Kept a plain function on the adapter type rather than folded into
 * `ConfigurationSchema`: `scripts/generateConfigManifest.ts` derives each
 * adapter's `shorthandKeys` by EXECUTING `normalizeSnapshot` against probe
 * snapshots and diffing what it derived, so the manifest — and the config docs
 * built from it — follow this without knowing it exists.
 */
export function expandTabixShorthand(
  snap: Record<string, unknown>,
  locationKey: string,
) {
  return snap.uri
    ? {
        ...snap,
        [locationKey]: { uri: snap.uri, baseUri: snap.baseUri },
        index: tabixIndexSnapshot(snap),
      }
    : snap
}
