import { decodeMafStatus } from '../util/mafStatus.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafEmptyRow,
  MafRegionData,
  MafWireRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * Rehydrate the columnar wire into per-block row objects, assigning each row its
 * on-screen row index.
 *
 * The worker names rows by species and knows nothing about display order, so
 * this is where a fetched row becomes a *placed* row. Placement runs against
 * `rowIndexBySrc` — the same `sources`→row projection every label, overlay and
 * hit test uses — so the payload and the labels can't disagree about which row
 * is which. It is also what lets a reorder re-place cached data instead of
 * refetching it (see the placement autorun in the state model).
 *
 * Rows the display isn't drawing are dropped rather than placed at a sentinel:
 * a species can be in the file but absent from `sources` (a stale saved layout,
 * or a discovery track mid-union), and everything downstream — the instance
 * buffer, `rowFlank`, the identity plot — keys on `rowIndex` and would collide
 * on a shared sentinel.
 *
 * Rehydrating here rather than in the worker is what lets the wire be columnar
 * for free: this function already had to rebuild every row object to stamp
 * `rowIndex` on it, so materializing them from typed arrays instead of from
 * other objects costs almost nothing (measured 30ms → 47ms at 83k rows) against
 * the seconds it saves in `postMessage`. Every sequence field is an
 * `arena.subarray` view, so no bases are copied here or on any later reorder.
 */
export function placeMafRegionData(
  data: MafWireRegionData,
  rowIndexBySrc: Map<string, number>,
): MafRegionData {
  const {
    arena,
    rowOffset,
    rowLength,
    rowSample,
    rowChr,
    rowStart,
    rowStrand,
    rowSrcSize,
    rowHasContext,
    rowLeftStatus,
    rowLeftCount,
    rowRightStatus,
    rowRightCount,
    blockStartBp,
    blockEndBp,
    blockRefOffset,
    blockRefLength,
    blockRowStart,
    blockEmptyStart,
    emptySample,
    emptyChr,
    emptyStatus,
    emptyStart,
    emptySize,
    emptyStrand,
    emptySrcSize,
    sampleIds,
    chrNames,
  } = data

  // The species→screen-row projection resolved once per region instead of once
  // per row: rows carry a sample *index*, and there are tens of thousands of
  // rows over a couple dozen species. -1 is "not drawn", i.e. dropped below.
  const rowIndexBySample = sampleIds.map(id => rowIndexBySrc.get(id) ?? -1)

  const blocks: MafBlock[] = []
  for (let block = 0; block < blockStartBp.length; block++) {
    const rows: MafAlignedRow[] = []
    for (let i = blockRowStart[block]!; i < blockRowStart[block + 1]!; i++) {
      const rowIndex = rowIndexBySample[rowSample[i]!]!
      if (rowIndex >= 0) {
        const offset = rowOffset[i]!
        rows.push({
          rowIndex,
          sampleId: sampleIds[rowSample[i]!],
          alignmentBytes: arena.subarray(offset, offset + rowLength[i]!),
          chr: chrNames[rowChr[i]!],
          start: rowStart[i]!,
          strand: rowStrand[i]!,
          // 0 is the wire's "the adapter supplied none" — a source sequence of
          // length 0 is not a thing, so the sentinel can't collide with a real
          // srcSize.
          srcSize: rowSrcSize[i] === 0 ? undefined : rowSrcSize[i],
          // `rowHasContext` and not a truthy status: a row can carry an `i`
          // line whose statuses are both unrecognized, which still means the
          // tooltip has context to show.
          context: rowHasContext?.[i]
            ? {
                leftStatus: decodeMafStatus(rowLeftStatus?.[i] ?? 0),
                leftCount: rowLeftCount?.[i],
                rightStatus: decodeMafStatus(rowRightStatus?.[i] ?? 0),
                rightCount: rowRightCount?.[i],
              }
            : undefined,
        })
      }
    }

    const empties: MafEmptyRow[] = []
    for (let i = blockEmptyStart[block]!; i < blockEmptyStart[block + 1]!; i++) {
      const rowIndex = rowIndexBySample[emptySample[i]!]!
      const status = decodeMafStatus(emptyStatus[i]!)
      // An `e` line with no recognized status has nothing to draw — the status
      // is what picks the line style — and the adapters already drop those, so
      // this only guards a wire that somehow carried one.
      if (rowIndex >= 0 && status !== undefined) {
        empties.push({
          rowIndex,
          sampleId: sampleIds[emptySample[i]!],
          status,
          chr: chrNames[emptyChr[i]!] ?? '',
          start: emptyStart[i]!,
          size: emptySize[i]!,
          strand: emptyStrand[i]!,
          srcSize: emptySrcSize[i]!,
        })
      }
    }

    const refOffset = blockRefOffset[block]!
    blocks.push({
      startBp: blockStartBp[block]!,
      endBp: blockEndBp[block]!,
      refSeqBytes: arena.subarray(
        refOffset,
        refOffset + blockRefLength[block]!,
      ),
      rows,
      empties,
    })
  }

  return {
    blocks,
    coverage: data.coverage,
    refSampleId: data.refSampleId,
  }
}
