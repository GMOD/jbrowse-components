import {
  EMPTY_MAF_CELLS,
  buildMafChannels,
} from '../LinearMafRenderer/mafChannels.ts'
import { encodeSourceChromSpans } from './components/drawSourceChrom.ts'

import type {
  MafGpuProps,
  MafRegionData,
  MafRowsPayload,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/** Everything a region's rows encode reads beyond the region itself. */
export interface MafRowsEncodeProps {
  /** The rows are drawn base by base (`basesRenderingActive`). */
  basesActive: boolean
  gpu: MafGpuProps
  /** The rows' source-chromosome ranks, while the rows are colored by them. */
  sourceChromRanks: ReadonlyMap<number, ReadonlyMap<string, number>> | undefined
}

/**
 * One region's rows as the row marks' channels. Only the rendering on screen
 * encodes: the others' channels are empty or absent, which packs nothing and
 * releases the pass's GPU buffer.
 */
export function encodeMafRows(
  regionData: MafRegionData,
  { basesActive, gpu, sourceChromRanks }: MafRowsEncodeProps,
): MafRowsPayload {
  return {
    cells: basesActive
      ? buildMafChannels({ blocks: regionData.blocks, ...gpu })
      : EMPTY_MAF_CELLS,
    sourceChrom:
      sourceChromRanks &&
      encodeSourceChromSpans(regionData.blocks, sourceChromRanks),
  }
}
