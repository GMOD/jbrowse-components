import {
  bpInRegionFromCoord,
  bpInRegionFromIndex,
  buildBpInRegionIndex,
  buildViewProjection,
  projectBpToScreenPx,
} from './syntenyProjection.ts'

import type { SyntenyViewLike } from './syntenyProjection.ts'

function makeView(partial: Partial<SyntenyViewLike> = {}): SyntenyViewLike {
  return {
    bpPerPx: 1,
    offsetPx: 0,
    interRegionPaddingWidth: 2,
    minimumBlockWidth: 5,
    displayedRegions: [
      { assemblyName: 'a', refName: 'chr1', start: 0, end: 100 },
    ],
    ...partial,
  }
}

describe('buildViewProjection', () => {
  it('single region at bpPerPx=1, offsetPx=0', () => {
    const p = buildViewProjection(makeView())
    expect(p.regionOffsetPx.length).toBe(1)
    expect(p.regionOffsetPx[0]).toBe(0)
    expect(p.bpPerPx).toBe(1)
  })

  it('accumulates inter-region padding for non-elided regions', () => {
    const p = buildViewProjection(
      makeView({
        displayedRegions: [
          { assemblyName: 'a', refName: 'chr1', start: 0, end: 100 },
          { assemblyName: 'a', refName: 'chr2', start: 0, end: 100 },
          { assemblyName: 'a', refName: 'chr3', start: 0, end: 100 },
        ],
      }),
    )
    // bpPerPx=1, padding=2, regions sized 100bp=100px (well above minBlockWidth=5)
    expect(Array.from(p.regionOffsetPx)).toEqual([0, 100 + 2, 200 + 4])
  })

  it('skips padding for elided regions (below minimumBlockWidth)', () => {
    const p = buildViewProjection(
      makeView({
        bpPerPx: 100, // regions now render at ~1px, below minBlockWidth=5
        displayedRegions: [
          { assemblyName: 'a', refName: 'chr1', start: 0, end: 100 },
          { assemblyName: 'a', refName: 'chr2', start: 0, end: 100 },
        ],
      }),
    )
    // regionWidthPx = 100/100 = 1 < 5 → elided → no padding after first
    expect(p.regionOffsetPx[1]).toBe(1)
  })

  it('subtracts viewport offsetPx', () => {
    const p = buildViewProjection(makeView({ offsetPx: 30 }))
    expect(p.regionOffsetPx[0]).toBe(-30)
  })
})

describe('projectBpToScreenPx', () => {
  it('coord 0 of first region lands at screen pixel 0 (no offset)', () => {
    const p = buildViewProjection(makeView())
    expect(projectBpToScreenPx(0, 0, p)).toBe(0)
  })

  it('coord scales by bpPerPx', () => {
    const p = buildViewProjection(makeView({ bpPerPx: 2 }))
    expect(projectBpToScreenPx(50, 0, p)).toBe(25)
  })

  it('second region starts past padding', () => {
    const p = buildViewProjection(
      makeView({
        displayedRegions: [
          { assemblyName: 'a', refName: 'chr1', start: 0, end: 100 },
          { assemblyName: 'a', refName: 'chr2', start: 0, end: 100 },
        ],
      }),
    )
    expect(projectBpToScreenPx(0, 1, p)).toBe(102)
    expect(projectBpToScreenPx(10, 1, p)).toBe(112)
  })
})

describe('bpInRegionFromCoord', () => {
  const regions = [
    { assemblyName: 'a', refName: 'chr1', start: 0, end: 100 },
    { assemblyName: 'a', refName: 'chr2', start: 100, end: 200 },
    {
      assemblyName: 'a',
      refName: 'chr1',
      start: 200,
      end: 300,
      reversed: true,
    },
  ]

  it('finds forward region', () => {
    expect(bpInRegionFromCoord(regions, 'chr1', 50)).toEqual({
      regionIdx: 0,
      bpInRegion: 50,
    })
  })

  it('reversed region inverts bp-offset', () => {
    expect(bpInRegionFromCoord(regions, 'chr1', 250)).toEqual({
      regionIdx: 2,
      bpInRegion: 300 - 250,
    })
  })

  it('disambiguates by displayedRegionIndex when multiple regions share refName', () => {
    expect(bpInRegionFromCoord(regions, 'chr1', 50, 0)).toEqual({
      regionIdx: 0,
      bpInRegion: 50,
    })
    expect(bpInRegionFromCoord(regions, 'chr1', 50, 2)).toBeUndefined()
  })

  it('returns undefined for out-of-range coord', () => {
    expect(bpInRegionFromCoord(regions, 'chrZ', 50)).toBeUndefined()
    expect(bpInRegionFromCoord(regions, 'chr1', 400)).toBeUndefined()
  })
})

describe('bpInRegionFromIndex', () => {
  const regions = [
    { assemblyName: 'a', refName: 'chr1', start: 0, end: 100 },
    { assemblyName: 'a', refName: 'chr2', start: 100, end: 200 },
    {
      assemblyName: 'a',
      refName: 'chr1',
      start: 200,
      end: 300,
      reversed: true,
    },
  ]
  const index = buildBpInRegionIndex(regions)

  it('matches bpInRegionFromCoord for forward region', () => {
    expect(bpInRegionFromIndex(index, 'chr1', 50)).toEqual({
      regionIdx: 0,
      bpInRegion: 50,
    })
  })

  it('matches bpInRegionFromCoord for reversed region', () => {
    expect(bpInRegionFromIndex(index, 'chr1', 250)).toEqual({
      regionIdx: 2,
      bpInRegion: 50,
    })
  })

  it('disambiguates by displayedRegionIndex', () => {
    expect(bpInRegionFromIndex(index, 'chr1', 50, 0)?.regionIdx).toBe(0)
    expect(bpInRegionFromIndex(index, 'chr1', 50, 2)).toBeUndefined()
  })
})
