import type { FeatureData } from './webglRpcTypes.ts'

/**
 * Build the per-read TypedArrays that pileup and chain executors share. Y
 * values are zero-filled — main-thread layout populates them.
 *
 * Read index is the feature's position in `features`; detail builders carry
 * that integer on each primitive (no id→index map needed).
 *
 * Chain mode calls this for the common 10 fields and then layers chain-
 * specific arrays (readChainIndices, readChainHasSupp, readNextRefs) in a
 * separate pass over `features`.
 */
export function buildBaseReadArrays(
  features: FeatureData[],
  regionStart: number,
) {
  const n = features.length
  const readPositions = new Uint32Array(n * 2)
  const readYs = new Uint16Array(n)
  const readFlags = new Uint16Array(n)
  const readMapqs = new Uint8Array(n)
  const readInsertSizes = new Float32Array(n)
  const readPairOrientations = new Uint8Array(n)
  const readStrands = new Int8Array(n)
  const readIds: string[] = []
  const readNames: string[] = []

  for (let i = 0; i < n; i++) {
    const f = features[i]!
    readPositions[i * 2] = Math.max(regionStart, f.start)
    readPositions[i * 2 + 1] = f.end
    readFlags[i] = f.flags
    readMapqs[i] = Math.min(255, f.mapq)
    readInsertSizes[i] = f.insertSize
    readPairOrientations[i] = f.pairOrientation
    readStrands[i] = f.strand
    readIds.push(f.id)
    readNames.push(f.name)
  }

  return {
    readArrays: {
      readPositions,
      readYs,
      readFlags,
      readMapqs,
      readInsertSizes,
      readPairOrientations,
      readStrands,
      readIds,
      readNames,
    },
  }
}
