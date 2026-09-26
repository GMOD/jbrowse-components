import { isPlainObject } from '../util/objectUtils.ts'
import { fillLocations } from './fillLocations.ts'
import { indexSuffix, isCsiLocation } from './indexType.ts'

import type { IndexType, SiblingIndexType } from './indexType.ts'

/**
 * The index type a config asks for, by whichever of its three spellings: the
 * `csi` flag, `index.indexType`, or the extension on the index file it names.
 * Explicit beats derived.
 *
 * One reader for all three, because they are one fact and disagreeing copies of
 * it open the wrong parser — `openTabixIndexFilehandle` hands @gmod/tabix a
 * `csiFilehandle` or a `tbiFilehandle` off `indexType` alone.
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
 * The `index` half of an indexed adapter's shorthand snapshot. The filename
 * follows from {@link requestedIndexType}, so the type and the extension cannot
 * disagree, and whatever the config wrote under `index` then wins member by
 * member: naming a location keeps the derived type, naming a type keeps the
 * derived location, and an `indexType` the enumeration does not have reaches MST
 * to be refused rather than being quietly read as the sibling format.
 */
export function indexSnapshot(
  snap: Record<string, unknown>,
  fallback: SiblingIndexType,
) {
  const indexType = requestedIndexType(snap, fallback)
  return {
    indexType,
    location: {
      uri: `${snap.uri}${indexSuffix(indexType)}`,
      baseUri: snap.baseUri,
    },
    ...(isPlainObject(snap.index) ? snap.index : {}),
  }
}

/** {@link indexSnapshot} for the tabix family, whose sibling format is TBI. */
export function tabixIndexSnapshot(snap: Record<string, unknown>) {
  return indexSnapshot(snap, 'TBI')
}

/**
 * Expand a tabix adapter's one-line shorthand — `{ uri: 'x.gff.gz' }`, plus
 * optional `csi` — into the full `{ <locationKey>, index }` snapshot, or pass a
 * snapshot already in full form through untouched.
 *
 * `locationKey` is the only thing that differs between adapters
 * (`gffGzLocation`, `vcfGzLocation`, `bedGzLocation`, `pifGzLocation`, …). An
 * adapter whose shorthand carries more (maf's `nhUri`) composes
 * `tabixIndexSnapshot` directly.
 *
 * Kept a plain function rather than folded into `ConfigurationSchema`:
 * `scripts/generateConfigManifest.ts` derives each adapter's `shorthandKeys` by
 * EXECUTING `normalizeSnapshot` against probe snapshots, so the manifest and the
 * config docs follow this without knowing it exists. It finds the candidate keys
 * by reading them out of source, following what an adapter schema imports.
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
