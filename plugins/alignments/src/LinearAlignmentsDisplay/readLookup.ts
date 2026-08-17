import { readNameAt } from '../shared/readNameBlock.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColoredByGroup } from './groupLayout.ts'
import type { ReadIdIndexMap } from './groupedDataMaps.ts'
import type { Region } from '@jbrowse/core/util'

export interface ReadHit {
  displayedRegionIndex: number
  groupKey: string
  idx: number
  rpcData: PileupDataResult
  start: number
  end: number
}

/**
 * Where one read id lives in the laid-out data: which lane, which region, and
 * its slot in that region's per-read arrays, plus the aligned extent read off
 * `readPositions`.
 *
 * The whole id → data resolution, in one function, because every consumer needs
 * a different field of the same answer — the hover tooltip wants the read's
 * flags, the overlay wants its row, the details fetch wants its region — and a
 * second lookup that stopped one level short would silently answer for a read in
 * another lane. Undefined when the id resolves to nothing: `readIdIndexMap` is
 * built from a fetch that may since have been replaced.
 */
export function findRead(
  readIdIndexMap: ReadIdIndexMap,
  laidOutByGroup: ColoredByGroup,
  featureId: string,
): ReadHit | undefined {
  const entry = readIdIndexMap.get(featureId)
  if (!entry) {
    return undefined
  }
  const { displayedRegionIndex, groupKey, idx } = entry
  const rpcData = laidOutByGroup.get(groupKey)?.get(displayedRegionIndex)
  if (!rpcData) {
    return undefined
  }
  const start = rpcData.readPositions[idx * 2]
  const end = rpcData.readPositions[idx * 2 + 1]
  return start !== undefined && end !== undefined
    ? { displayedRegionIndex, groupKey, idx, rpcData, start, end }
    : undefined
}

/**
 * The read's own fields, for the tooltip, the hovered-feature stub and the
 * details fetch.
 *
 * `refName`/`assemblyName` come from the region the read was FETCHED from rather
 * than from `view.displayedRegions`, which needs a sentinel for a since-changed
 * index and carries no assembly — leaving the details fetch to re-find one by
 * refName.
 */
export function readInfo(hit: ReadHit, region: Region, featureId: string) {
  const { idx, rpcData, start, end } = hit
  return {
    id: featureId,
    name: readNameAt(rpcData, idx),
    start,
    end,
    flags: rpcData.readFlags[idx],
    mapq: rpcData.readMapqs[idx],
    // The worker's own normalized strand, not a re-derivation from
    // SAM_FLAG_REVERSE. Identical for BAM/CRAM (whose `strand` IS that flag),
    // but a PAF/synteny block carries a real strand and no flags at all — so the
    // flag read reported every reverse-strand block as `(+)` in the hover
    // tooltip and in `hoveredFeature`. Same reasoning as `strandKey` in
    // shared/groupFeatures.ts.
    strand: rpcData.readStrands[idx] ?? 1,
    refName: region.refName,
    assemblyName: region.assemblyName,
  }
}

/**
 * Read ids sharing a chain with the read at `index` — the read's own included,
 * since it is a member of its chain. Empty when the read isn't part of a chain.
 * Shared by hover-highlight and click-select so the two paths can't drift.
 */
export function chainReadIdsAt(
  rpcData: {
    readChainIndices?: ArrayLike<number>
    chainNames?: readonly string[]
  },
  index: number,
  readIdsByChainName: ReadonlyMap<string, string[]>,
) {
  const { readChainIndices, chainNames } = rpcData
  const chainIdx = readChainIndices?.[index]
  const name = chainIdx === undefined ? undefined : chainNames?.[chainIdx]
  return name === undefined ? [] : (readIdsByChainName.get(name) ?? [])
}
