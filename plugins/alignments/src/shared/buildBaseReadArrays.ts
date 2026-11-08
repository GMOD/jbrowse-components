import type { FeatureData } from './webglRpcTypes.ts'
import type { ReadKeys } from '@jbrowse/alignments-core'

/**
 * Collect the per-read identity keys. Numeric — one transferable rather than
 * `n` cloned strings — whenever the features' record ids are their ids
 * (`numericKeys`). See alignments-core/src/readIdentity.ts for the measurement
 * and the invariant.
 *
 * Every feature of one fetch comes from one adapter, so the branch is uniform;
 * the per-read check is only there so a mixed set falls back to strings rather
 * than writing `NaN` into the array.
 */
function buildReadKeys(
  features: FeatureData[],
  numericKeys: boolean,
): ReadKeys {
  const n = features.length
  if (numericKeys) {
    const keys = new Float64Array(n)
    let i = 0
    for (; i < n; i++) {
      const key = features[i]!.id
      if (typeof key !== 'number') {
        break
      }
      keys[i] = key
    }
    if (i === n) {
      return keys
    }
  }
  return features.map(f => `${f.id}`)
}

/**
 * Build the per-read TypedArrays. No row: `readYs` is a `PileupLayoutArrays`
 * field, allocated by the main-thread layout that can answer it. No chain
 * fields either: the main thread joins those (`attachChainFields`). The mate
 * reference is `buildReadNextRefs`, off the raw features.
 *
 * Read index is the feature's position in `features`; detail builders carry
 * that integer on each primitive (no id→index map needed).
 *
 * readPositions is the read's true alignment span — one meaning, no region
 * involved. It used to clip `start` to the region, a leftover from when these
 * were regionStart-relative and a read starting left of the block underflowed
 * the Uint32Array; absolute coords need no such guard, and the clipped start
 * was silently wrong biology (it matched no SA twin, so arcs left a duplicate
 * segment in the chain that painted as a spurious same-strand "deletion", and
 * the details tooltip reported a false start that moved as you scrolled).
 *
 * Clipping to the region belongs to the drawn geometry alone, and lives there:
 * buildSegments keeps true positions too, and the renderers clip to the block.
 */
export function buildBaseReadArrays(
  features: FeatureData[],
  numericKeys: boolean,
) {
  const n = features.length
  const readPositions = new Uint32Array(n * 2)
  const readFlags = new Uint16Array(n)
  const readMapqs = new Uint8Array(n)
  const readInsertSizes = new Float32Array(n)
  const readPairOrientations = new Uint8Array(n)
  const readStrands = new Int8Array(n)

  for (let i = 0; i < n; i++) {
    const f = features[i]!
    readPositions[i * 2] = f.start
    readPositions[i * 2 + 1] = f.end
    readFlags[i] = f.flags
    readMapqs[i] = Math.min(255, f.mapq)
    readInsertSizes[i] = f.insertSize
    readPairOrientations[i] = f.pairOrientation
    readStrands[i] = f.strand
  }

  return {
    readArrays: {
      readPositions,
      readFlags,
      readMapqs,
      readInsertSizes,
      readPairOrientations,
      readStrands,
      readKeys: buildReadKeys(features, numericKeys),
    },
  }
}
