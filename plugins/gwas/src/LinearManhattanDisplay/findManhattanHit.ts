import { nearestMarkHit } from '@jbrowse/render-core/marks'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type {
  ManhattanRenderState,
  StoredManhattanData,
} from './manhattanRenderingBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
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
  regionData: ReadonlyMap<number, StoredManhattanData>,
  state: ManhattanRenderState,
  displayedRegions: readonly { refName: string }[],
): ManhattanHit | undefined {
  const hit = nearestMarkHit(
    MANHATTAN_MARKS,
    blocks,
    index => regionData.get(index),
    state,
    mouseX,
    mouseY,
    {
      radiusPx: HIT_RADIUS_PX,
      candidates: (data, _mark, { bpMin, bpMax, valueMin, valueMax }) =>
        data.flatbush?.search(bpMin, valueMin, bpMax, valueMax),
    },
  )
  if (!hit) {
    return undefined
  }
  const { region: data, index, block } = hit
  const regionIndex = block.displayedRegionIndex
  return {
    refName: displayedRegions[regionIndex]!.refName,
    start: data.x[index]!,
    end: data.x2[index]!,
    score: data.y[index]!,
    regionIndex,
    instance: index,
  }
}
