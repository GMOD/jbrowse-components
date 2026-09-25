import { isPlainObject } from '../util/objectUtils.ts'
import { fillLocations } from './fillLocations.ts'
import { indexSuffix, isCsiLocation } from './indexType.ts'

import type { IndexType, SiblingIndexType } from './indexType.ts'

/**
 * The index type a config asks for, by whichever of the three spellings it used:
 * the `csi` shorthand flag, `index.indexType`, or the extension on the index file
 * it named. Explicit beats derived, and `fallback` is the family's sibling
 * format (`TBI` for tabix, `BAI` for BAM).
 *
 * One reader for all three because they are one fact, and disagreeing copies of
 * it open the wrong parser: `openTabixIndexFilehandle` hands @gmod/tabix a
 * `csiFilehandle` or a `tbiFilehandle` off `indexType` alone, so a `.csi` read as
 * a TBI fails on a config where every file named is the right one.
 */
export function requestedIndexType(
  snap: Record<string, unknown>,
  fallback: SiblingIndexType,
): IndexType {
  const written = isPlainObject(snap.index) ? snap.index : undefined
  const declared = written?.indexType
  if (declared === 'CSI') {
    return 'CSI'
  }
  if (declared === fallback) {
    return fallback
  }
  return snap.csi || isCsiLocation(written?.location) ? 'CSI' : fallback
}

/**
 * The `index` half of an indexed adapter's shorthand snapshot: which index kind,
 * and where it is. `fallback` is the family's sibling format — `TBI` for tabix,
 * `BAI` for BAM.
 *
 * The type comes from {@link requestedIndexType}, and the filename follows from
 * the type rather than being chosen beside it. So `csi: true`,
 * `index: { indexType: 'CSI' }` and a named `<file>.gz.csi` each produce a CSI
 * index with a `.csi` file, where a config writing two of them used to lose one:
 * the shorthand's `indexType` was overwritten whole by any `index` the config
 * spelled out, which is a track pointing at the right file and opening it with
 * the wrong parser.
 *
 * Whatever the config wrote under `index` still wins, member by member, so
 * naming an index that does not sit beside its data file keeps the derived type
 * and naming only the type keeps the derived file.
 */
export function indexSnapshot(
  snap: Record<string, unknown>,
  fallback: SiblingIndexType,
) {
  const indexType = requestedIndexType(snap, fallback)
  return {
    location: {
      uri: `${snap.uri}${indexSuffix(indexType)}`,
      baseUri: snap.baseUri,
    },
    ...(isPlainObject(snap.index) ? snap.index : {}),
    // last, and not an override: `requestedIndexType` has already read whatever
    // the config wrote here, along with the two other ways it can say the same
    // thing
    indexType,
  }
}

/** {@link indexSnapshot} for the tabix family, whose sibling format is TBI. */
export function tabixIndexSnapshot(snap: Record<string, unknown>) {
  return indexSnapshot(snap, 'TBI')
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
 * built from it — follow this without knowing it exists. It finds the candidate
 * keys by reading `snap.<key>` out of source, which is why every shorthand key
 * an adapter accepts is read in a `*Shorthand.ts` file or in the schema itself.
 */
export function expandTabixShorthand(
  snap: Record<string, unknown>,
  locationKey: string,
) {
  return snap.uri
    ? {
        ...fillLocations(snap, {
          [locationKey]: { uri: snap.uri, baseUri: snap.baseUri },
        }),
        index: tabixIndexSnapshot(snap),
      }
    : snap
}
