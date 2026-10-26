import { decodeMafStatus } from '../util/mafStatus.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafEmptyRow,
  MafRegionData,
  MafWireRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * Rehydrate the columnar wire into per-block row objects, assigning each row
 * its on-screen row index from `rowIndexBySrc`, the `sources`-to-row projection
 * that labels, overlays and hit tests share. A reorder re-places cached data
 * without refetching.
 *
 * Rows the display isn't drawing are dropped, not placed at a sentinel:
 * downstream code keys on `rowIndex`, and a shared sentinel would collide.
 *
 * Every sequence field is an `arena.subarray` view, so no bases are copied here
 * or on any later reorder.
 *
 * Each block lists its rows in `rowIndex` order, the order the painters draw
 * them in. Below a pixel per row the drawn bands overlap, and the hit test
 * answers the highest index as the one painted last.
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

  // The species-to-screen-row projection, resolved once per region; -1 means
  // not drawn.
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
          srcStart: rowStart[i]!,
          strand: rowStrand[i]!,
          // 0 is the wire's "the adapter supplied none"; a real srcSize is
          // never 0.
          srcSize: rowSrcSize[i] === 0 ? undefined : rowSrcSize[i],
          // `rowHasContext`, not a truthy status: an `i` line with two
          // unrecognized statuses still has tooltip context.
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
    for (
      let i = blockEmptyStart[block]!;
      i < blockEmptyStart[block + 1]!;
      i++
    ) {
      const rowIndex = rowIndexBySample[emptySample[i]!]!
      const status = decodeMafStatus(emptyStatus[i]!)
      // An `e` line with no recognized status has nothing to draw; the adapters
      // already drop those.
      if (rowIndex >= 0 && status !== undefined) {
        empties.push({
          rowIndex,
          sampleId: sampleIds[emptySample[i]!],
          status,
          chr: chrNames[emptyChr[i]!] ?? '',
          srcStart: emptyStart[i]!,
          size: emptySize[i]!,
          strand: emptyStrand[i]!,
          srcSize: emptySrcSize[i]!,
        })
      }
    }

    sortByRowIndex(rows)
    sortByRowIndex(empties)
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

function sortByRowIndex(rows: { rowIndex: number }[]) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.rowIndex < rows[i - 1]!.rowIndex) {
      rows.sort((a, b) => a.rowIndex - b.rowIndex)
      return
    }
  }
}
