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
