import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { buildBaseTupleMap } from '../../features/mismatch/baseColors.ts'
import { UNIFORM_OFFSET_U32 } from '../../shaders/slang/read.iface.generated.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsSources } from './rendererTypes.ts'

/**
 * The five per-base colours reach the GPU as UBO slots and Canvas2D as a tuple
 * map, and both resolve through `effectiveBaseColors` — but only the CPU side of
 * that is unit-tested (`features/mismatch/baseColors.test.ts`). What is left is
 * the projection: five named uniform slots, filled from five named fields, in a
 * renderer that cannot say which base a slot is for. A transposed pair paints
 * every A as a C on the GPU and nowhere else.
 *
 * The two halves were joined only by a comment ("keep in sync when changing
 * this") until they shared `effectiveBaseColors`; this is the part sharing
 * cannot cover.
 */

const BASE_SLOTS = [
  ['A', 65, UNIFORM_OFFSET_U32.colorBaseA],
  ['C', 67, UNIFORM_OFFSET_U32.colorBaseC],
  ['G', 71, UNIFORM_OFFSET_U32.colorBaseG],
  ['T', 84, UNIFORM_OFFSET_U32.colorBaseT],
  ['N', 78, UNIFORM_OFFSET_U32.colorBaseN],
] as const

function renderState(showModifications: boolean) {
  return makeTestRenderState({
    showModifications,
    // Five DISTINCT base colours, so a transposed slot shows as a mismatch
    // rather than as two equal greys.
    colors: makeTestPalette({
      colorBaseA: [1, 0, 0],
      colorBaseC: [0, 1, 0],
      colorBaseG: [0, 0, 1],
      colorBaseT: [1, 1, 0],
      colorBaseN: [0, 1, 1],
      colorMutedSnpBase: [0.5, 0.5, 0.5],
    }),
  })
}

// The uniforms the renderer last wrote, after one block of one empty region.
function gpuBaseSlots(showModifications: boolean) {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  const sources: AlignmentsSources = {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, makePileupDataResult({})]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
  renderer.upload('sources', sources)
  renderer.renderBlocks(
    [
      {
        displayedRegionIndex: 0,
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: 200,
        reversed: false,
      },
    ],
    renderState(showModifications),
  )
  const u32 = hal.getLastUniformsU32()!
  return Object.fromEntries(
    BASE_SLOTS.map(([base, , slot]) => [base, u32[slot]]),
  )
}

function canvasBaseColors(showModifications: boolean) {
  const tuples = buildBaseTupleMap(renderState(showModifications))
  return Object.fromEntries(
    BASE_SLOTS.map(([base, code]) => {
      const rgb = tuples[code]!
      return [base, normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])]
    }),
  )
}

test('each GPU base slot carries the colour Canvas2D gives that base', () => {
  expect(gpuBaseSlots(false)).toEqual(canvasBaseColors(false))
})

test('and still does under show-modifications, where all five mute', () => {
  const gpu = gpuBaseSlots(true)
  expect(gpu).toEqual(canvasBaseColors(true))
  // Guards the guard: five equal greys would satisfy the comparison above even
  // if the slots were transposed, so the unmuted case is the one carrying the
  // transposition check — assert it really is five distinct colours there.
  expect(new Set(Object.values(gpuBaseSlots(false))).size).toBeGreaterThan(1)
  expect(new Set(Object.values(gpu)).size).toBe(1)
})
