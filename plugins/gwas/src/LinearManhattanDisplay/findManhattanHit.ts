import { nearestMarkHit, valueWindow } from '@jbrowse/render-core/marks'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  // r² to the index SNP in LD mode (1 for the index, NaN where absent);
  // undefined in normal coloring mode.
  r2?: number
  /** The instance in its region's payload, which the highlight lights. */
  regionIndex: number
  instance: number
}

const HIT_RADIUS_PX = 8

/**
 * The point nearest the cursor, asked of each region's worker-built Flatbush
 * over (bp, score) within the grab radius's value window.
 */
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: RenderBlock[],
  regionData: ReadonlyMap<number, ManhattanRpcResult>,
  flatbushMap: ReadonlyMap<number, Flatbush>,
  state: ManhattanRenderState,
  refNames: ReadonlyMap<number, string>,
): ManhattanHit | undefined {
  const [scoreMin, scoreMax] = valueWindow(
    mouseY,
    HIT_RADIUS_PX,
    state.canvasHeight,
    { domain: state.domainY },
  )
  const hit = nearestMarkHit(
    MANHATTAN_MARKS,
    blocks,
    index => (refNames.has(index) ? regionData.get(index) : undefined),
    state,
    mouseX,
    mouseY,
    {
      radiusPx: HIT_RADIUS_PX,
      candidates: (_data, _mark, { block, bpMin, bpMax }) =>
        flatbushMap
          .get(block.displayedRegionIndex)
          ?.search(bpMin, scoreMin, bpMax, scoreMax),
    },
  )
  if (!hit) {
    return undefined
  }
  const { region: data, index, block } = hit
  const regionIndex = block.displayedRegionIndex
  // NaN r² (SNP absent from LD data) normalizes to undefined so the tooltip and
  // feature widget can treat "no r²" uniformly.
  const r2 = data.r2s?.[index]
  return {
    refName: refNames.get(regionIndex)!,
    start: data.x[index]!,
    end: data.x2[index]!,
    score: data.y[index]!,
    r2: Number.isFinite(r2) ? r2 : undefined,
    regionIndex,
    instance: index,
  }
}
