import { fetchWindowSignature } from './regionSignature.ts'
import {
  PAN_BUFFER_PX,
  syntenyFetchRegions,
  syntenyPanBufferPx,
} from './syntenyFetchWindow.ts'

const ASM = 'test'

// A whole chromosome as the displayed region; wide enough that the fetch window
// never clamps unless a test intends it to.
const wholeChr = {
  refName: 'chr1',
  assemblyName: ASM,
  start: 0,
  end: 200_000_000,
}

function vis(start: number, end: number) {
  return {
    refName: 'chr1',
    assemblyName: ASM,
    start,
    end,
    displayedRegionIndex: 0,
  }
}

describe('syntenyPanBufferPx', () => {
  it('floors at PAN_BUFFER_PX on narrow views', () => {
    expect(syntenyPanBufferPx(800)).toBe(PAN_BUFFER_PX)
  })
  it('widens to half the viewport on wide views', () => {
    expect(syntenyPanBufferPx(8000)).toBe(4000)
  })
})

describe('syntenyFetchRegions', () => {
  it('is a superset of the [start - buffer, end + buffer] cull window', () => {
    const width = 800
    const bpPerPx = 1000
    const bufferBp = syntenyPanBufferPx(width) * bpPerPx
    const [r] = syntenyFetchRegions({
      visibleRegions: [vis(50_000_000, 51_000_000)],
      displayedRegions: [wholeChr],
      width,
      bpPerPx,
    })
    expect(r!.start).toBeLessThanOrEqual(50_000_000 - bufferBp)
    expect(r!.end).toBeGreaterThanOrEqual(51_000_000 + bufferBp)
  })

  it('snaps to a buffer-sized grid so sub-buffer pans reuse the same window', () => {
    const width = 800
    const bpPerPx = 1000
    const call = (start: number, end: number) =>
      syntenyFetchRegions({
        visibleRegions: [vis(start, end)],
        displayedRegions: [wholeChr],
        width,
        bpPerPx,
      })[0]!
    const base = call(50_000_000, 51_000_000)
    // pans smaller than one buffer (2_000_000 bp) stay in the same grid cell
    for (const shift of [100_000, 500_000, 1_000_000]) {
      const panned = call(50_000_000 + shift, 51_000_000 + shift)
      expect(panned).toEqual(base)
    }
    // a pan past the buffer moves the snapped window
    const moved = call(53_000_000, 54_000_000)
    expect(moved).not.toEqual(base)
  })

  it('clamps the window to the enclosing displayed region', () => {
    const region = {
      refName: 'chr1',
      assemblyName: ASM,
      start: 1000,
      end: 9000,
    }
    const [r] = syntenyFetchRegions({
      visibleRegions: [
        {
          refName: 'chr1',
          assemblyName: ASM,
          start: 4000,
          end: 5000,
          displayedRegionIndex: 0,
        },
      ],
      displayedRegions: [region],
      width: 800,
      bpPerPx: 1,
    })
    expect(r!.start).toBeGreaterThanOrEqual(region.start)
    expect(r!.end).toBeLessThanOrEqual(region.end)
  })

  it('collapses to the whole displayed region when the buffered window covers it', () => {
    // small region fully inside one buffer -> fetch the whole region, and stay
    // stable (no pan-refetch) as the visible sub-window moves within it
    const region = {
      refName: 'chr1',
      assemblyName: ASM,
      start: 0,
      end: 1_000_000,
    }
    const call = (start: number, end: number) =>
      syntenyFetchRegions({
        visibleRegions: [
          {
            refName: 'chr1',
            assemblyName: ASM,
            start,
            end,
            displayedRegionIndex: 0,
          },
        ],
        displayedRegions: [region],
        width: 800,
        bpPerPx: 250,
      })[0]!
    expect(call(400_000, 600_000)).toEqual({
      refName: 'chr1',
      assemblyName: ASM,
      start: 0,
      end: 1_000_000,
    })
    // panning within the region does not change the (whole-region) window
    expect(call(200_000, 400_000)).toEqual(call(600_000, 800_000))
  })
})

// The invariant the emit window rests on: the worker emits geometry for the
// fetch window and nothing past it, and the fetch key is that window's
// signature, so every viewport that shares the key must sit inside the window —
// with the band's overdraw, capped at PAN_BUFFER_PX, on each side, since a
// ribbon edge that far outside the viewport still draws. Once broken, the
// trailing strip of a pan draws nothing while `dataCurrent` reports true.
//
// Checked over a sweep of viewport starts rather than a pair: within one grid
// cell of the snap the window is constant and the viewport moves, and the
// clamp then pins the window to the displayed region over a pan the region
// alone bounds, which is where a fixed-pad emit window was wrong.
describe('every viewport sharing a fetch key sits inside its window', () => {
  function violations({
    width,
    bpPerPx,
    regionEnd,
  }: {
    width: number
    bpPerPx: number
    regionEnd: number
  }) {
    const region = {
      refName: 'chr1',
      assemblyName: ASM,
      start: 0,
      end: regionEnd,
    }
    const overdrawBp = PAN_BUFFER_PX * bpPerPx
    const held = new Map<string, { start: number; end: number }>()
    const out: { start: number; reach: number[]; window: number[] }[] = []
    const step = Math.max(1, Math.floor((37 * bpPerPx) / 3))
    for (let start = 0; start < regionEnd; start += step) {
      const end = Math.min(regionEnd, start + width * bpPerPx)
      const regions = syntenyFetchRegions({
        visibleRegions: [vis(start, end)],
        displayedRegions: [region],
        width,
        bpPerPx,
      })
      const key = fetchWindowSignature(regions)
      const window = held.get(key) ?? regions[0]!
      held.set(key, window)
      const reach = [
        Math.max(0, start - overdrawBp),
        Math.min(regionEnd, end + overdrawBp),
      ]
      if (reach[0]! < window.start || reach[1]! > window.end) {
        out.push({ start, reach, window: [window.start, window.end] })
      }
    }
    return out
  }

  // The regime the fixed-pad emit window was wrong in: a region a few buffers
  // wide, where the clamp holds the key over a pan of most of the region.
  it('holds on the 500kb region at 100bp/px the defect was worked at', () => {
    expect(
      violations({ width: 1400, bpPerPx: 100, regionEnd: 500_000 }),
    ).toEqual([])
  })

  it('holds across random widths, zooms and region lengths', () => {
    let seed = 0x2f6e2b1
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    for (let i = 0; i < 40; i++) {
      const width = 400 + Math.floor(rand() * 7600)
      const bpPerPx = 2 ** (rand() * 16 - 4)
      const bufferBp = syntenyPanBufferPx(width) * bpPerPx
      const regionEnd = Math.ceil(bufferBp * (0.5 + rand() * 8))
      expect({
        width,
        bpPerPx,
        regionEnd,
        violations: violations({ width, bpPerPx, regionEnd }),
      }).toEqual({ width, bpPerPx, regionEnd, violations: [] })
    }
  })
})
