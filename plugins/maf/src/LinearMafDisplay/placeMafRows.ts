import type {
  MafBlock,
  MafRegionData,
  MafWireRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * Assign each worker row its on-screen row index.
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
 */
export function placeMafRegionData(
  data: MafWireRegionData,
  rowIndexBySrc: Map<string, number>,
): MafRegionData {
  const blocks: MafBlock[] = data.blocks.map(block => {
    const rows: MafBlock['rows'] = []
    for (const row of block.rows) {
      const rowIndex = rowIndexBySrc.get(row.sampleId)
      if (rowIndex !== undefined) {
        rows.push({ ...row, rowIndex })
      }
    }
    const empties: MafBlock['empties'] = []
    for (const empty of block.empties) {
      const rowIndex = rowIndexBySrc.get(empty.sampleId)
      if (rowIndex !== undefined) {
        empties.push({ ...empty, rowIndex })
      }
    }
    return { ...block, rows, empties }
  })
  return {
    blocks,
    coverage: data.coverage,
    refSampleId: data.refSampleId,
  }
}
