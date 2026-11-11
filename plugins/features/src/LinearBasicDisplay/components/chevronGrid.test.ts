import {
  CHEVRON_END_GAP_PX,
  CHEVRON_H_PX,
  CHEVRON_THICKNESS_PX,
} from '../passes/shaders/chevron.consts.generated.ts'
import {
  chevronGridBp,
  chevronHalfHeightPx,
  chevronPhaseBp,
} from '../passes/shaders/chevron.js.generated.ts'
import {
  CHEVRON_SPACING_PX,
  CHEVRON_W_PX,
  chevronGridWindow,
  chevronSlotBudget,
} from './sharedRendererConstants.ts'

const HALF_W = CHEVRON_W_PX / 2
const BP_PER_PX = [0.013, 0.02, 1 / 7, 0.5, 1, 1.7, 3.7, 80, 137, 2500, 1e5]

function chevronsBp(
  startBp: number,
  lengthBp: number,
  bpPerPx: number,
  windowStartBp?: number,
  windowEndBp?: number,
) {
  const { grid, phase, first, last } = chevronGridWindow(
    startBp,
    lengthBp,
    bpPerPx,
    windowStartBp,
    windowEndBp,
  )
  const out = []
  for (let k = first; k <= last; k++) {
    out.push(startBp + phase + k * grid)
  }
  return out
}

test('the grid step is a power of two at least the spacing and under twice it', () => {
  for (const bpPerPx of BP_PER_PX) {
    const grid = chevronGridBp(bpPerPx)
    expect(Number.isInteger(Math.log2(grid))).toBe(true)
    expect(grid / bpPerPx).toBeGreaterThanOrEqual(CHEVRON_SPACING_PX)
    expect(grid / bpPerPx).toBeLessThan(2 * CHEVRON_SPACING_PX)
  }
})

test('isoforms starting anywhere put their chevrons in shared columns', () => {
  for (const bpPerPx of BP_PER_PX) {
    const grid = chevronGridBp(bpPerPx)
    const lengthBp = 3000 * bpPerPx
    for (const startBp of [1_000_003, 1_000_517, 1_013_000, 1_029_999]) {
      for (const bp of chevronsBp(startBp, lengthBp, bpPerPx)) {
        expect(bp / grid).toBe(Math.round(bp / grid))
      }
    }
  }
})

test('zooming in keeps every chevron and adds the ones between', () => {
  for (const bpPerPx of BP_PER_PX) {
    const startBp = 5_000_123
    const lengthBp = 2000 * bpPerPx
    const coarse = chevronsBp(startBp, lengthBp, bpPerPx)
    const fine = chevronsBp(startBp, lengthBp, bpPerPx / 2)
    expect(coarse.filter(bp => !fine.includes(bp))).toEqual([])
  }
})

test('a chevron keeps its arms and a gap clear of the exons either end', () => {
  for (const bpPerPx of BP_PER_PX) {
    const startBp = 777_777
    for (const widthPx of [5, 9, 12, 41, 300]) {
      const lengthBp = widthPx * bpPerPx
      for (const bp of chevronsBp(startBp, lengthBp, bpPerPx)) {
        const clearPx = (HALF_W + CHEVRON_END_GAP_PX) * bpPerPx
        expect(bp - startBp).toBeGreaterThanOrEqual(clearPx - 1e-9)
        expect(startBp + lengthBp - bp).toBeGreaterThanOrEqual(clearPx - 1e-9)
      }
    }
  }
})

test('the window keeps every chevron whose arms reach it, and walks no others', () => {
  const canvasPx = 800
  for (const bpPerPx of BP_PER_PX) {
    const startBp = 1_000_000
    const lengthBp = 5000 * bpPerPx
    const all = chevronsBp(startBp, lengthBp, bpPerPx)
    const grid = chevronGridBp(bpPerPx)
    for (const leadPx of [-6000, -400, -2, 0, 1, 300, 795, 4300, 9000]) {
      const lo = leadPx * bpPerPx
      const hi = lo + canvasPx * bpPerPx
      const inWindow = chevronsBp(startBp, lengthBp, bpPerPx, lo, hi)
      const reach = HALF_W * bpPerPx
      expect(inWindow).toEqual(
        all.filter(
          bp => bp - startBp + reach >= lo && bp - startBp - reach <= hi,
        ),
      )
      expect(inWindow.length).toBeLessThanOrEqual(
        Math.ceil((hi - lo) / grid) + 1,
      )
    }
  }
})

test('the per-draw budget covers the most grid points a canvas can show', () => {
  for (const canvasPx of [120, 320, 800, 1920, 3840, 7680]) {
    let most = 0
    for (const bpPerPx of BP_PER_PX) {
      const grid = chevronGridBp(bpPerPx)
      for (let lead = 0; lead < grid; lead += grid / 64) {
        const lo = lead
        const hi = lo + canvasPx * bpPerPx
        most = Math.max(
          most,
          chevronsBp(0, 10 * hi + grid, bpPerPx, lo, hi).length,
        )
      }
    }
    expect(most).toBeLessThanOrEqual(chevronSlotBudget(canvasPx))
  }
})

test('the phase is exact at a chromosome-scale start, where a float32 modulo is not', () => {
  const startBp = 3_000_000_001
  for (const grid of [2, 64, 4096, 2 ** 20, 2 ** 31]) {
    const phase = chevronPhaseBp(startBp, grid)
    expect((startBp + phase) % grid).toBe(0)
    expect(phase).toBeLessThan(grid)
  }
  expect(Math.fround(3_000_000_001) % 64).not.toBe(3_000_000_001 % 64)
  expect(chevronPhaseBp(startBp, 0.25)).toBe(0)
  expect(chevronPhaseBp(startBp, 2 ** 33)).toBe(2 ** 33 - startBp)
})

test('a chevron flattens to fit its box and leaves a box too short to hold one', () => {
  for (let boxPx = 0; boxPx <= 30; boxPx += 0.25) {
    const half = chevronHalfHeightPx(boxPx)
    expect(half).toBeLessThanOrEqual(CHEVRON_H_PX / 2)
    if (half > 0) {
      expect(2 * half + CHEVRON_THICKNESS_PX).toBeLessThanOrEqual(boxPx)
    }
  }
  expect(chevronHalfHeightPx(10)).toBe(CHEVRON_H_PX / 2)
  expect(chevronHalfHeightPx(3)).toBe(1)
  expect(chevronHalfHeightPx(2.5)).toBe(0)
})
