import { bpToRadians, layoutSlices } from './slices.ts'

import type { SliceRegion } from './slices.ts'

function region(start: number, end: number, reversed = false): SliceRegion {
  return {
    elided: false,
    widthBp: end - start,
    start,
    end,
    refName: 'r',
    assemblyName: 'a',
    reversed,
  }
}

test('bpToRadians maps position linearly within a non-elided block', () => {
  const block = {
    startRadians: 2,
    bpPerRadian: 100,
    region: region(1000, 1200),
  }
  expect(bpToRadians(block, 1000)).toBe(2)
  expect(bpToRadians(block, 1100)).toBe(3)
  expect(bpToRadians(block, 900)).toBe(1)
})

// A mirrored region runs the other way round the circle: its first base sits at
// the slice's END angle. Same span, walked backwards, which is what makes the
// second genome of a diagonalized circle a mirror of the first.
test('bpToRadians runs a reversed block from its end angle', () => {
  const block = {
    startRadians: 2,
    bpPerRadian: 100,
    region: region(1000, 1200, true),
  }
  expect(bpToRadians(block, 1000)).toBe(4)
  expect(bpToRadians(block, 1100)).toBe(3)
  expect(bpToRadians(block, 1200)).toBe(2)
})

test('bpToRadians collapses an elided block to its midpoint', () => {
  const block = {
    startRadians: 1,
    bpPerRadian: 100,
    region: {
      elided: true as const,
      widthBp: 200,
      regions: [{ assemblyName: 'a', refName: 'r', start: 0, end: 200 }],
    },
  }
  expect(bpToRadians(block, 999)).toBe(2)
})

test('one slice', () => {
  const view = {
    elidedRegions: [
      {
        elided: false,
        assemblyName: 'wow',
        refName: 'toast',
        start: 0,
        end: 10000,
        widthBp: 10000,
      },
    ] satisfies SliceRegion[],
    spacingPx: 5,
    radiusPx: 1000,
    totalBp: 10000,
    bpPerRadian: 10000 / (2 * Math.PI),
    pxPerRadian: 1000,
  }

  const slices = layoutSlices(view.elidedRegions, {
    radiansPerBp: 1 / view.bpPerRadian,
    gapRadians: view.spacingPx / view.radiusPx,
  })
  expect(slices.length).toBe(1)
  const [slice] = slices
  expect(slice).toMatchSnapshot()
})

// a plain slice next to an elided one: the two take their keys from different
// places (the loc string vs the swallowed regions), and a Slice has to end up
// with the right one
test('two slices', () => {
  const view = {
    elidedRegions: [
      {
        elided: false,
        assemblyName: 'wow',
        refName: 'toast',
        start: 0,
        end: 10000,
        widthBp: 10000,
      },
      {
        elided: true,
        widthBp: 10000,
        regions: [
          { assemblyName: 'wow', refName: 'tiny1', start: 0, end: 5000 },
          { assemblyName: 'wow', refName: 'tiny2', start: 0, end: 5000 },
        ],
      },
    ] satisfies SliceRegion[],
    spacingPx: 5,
    radiusPx: 1000,
    pxPerRadian: 1000,
    totalBp: 20000,
    bpPerRadian: 20000 / (2 * Math.PI),
  }

  const slices = layoutSlices(view.elidedRegions, {
    radiansPerBp: 1 / view.bpPerRadian,
    gapRadians: view.spacingPx / view.radiusPx,
  })
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})

test('volvox', () => {
  const totalBp = 50001 + 6079
  const view = {
    elidedRegions: [
      {
        elided: false,
        refName: 'ctgA',
        start: 0,
        end: 50001,
        assemblyName: 'volvox',
        widthBp: 50001,
      },
      {
        elided: false,
        refName: 'ctgB',
        start: 0,
        end: 6079,
        assemblyName: 'volvox',
        widthBp: 6079,
      },
    ] satisfies SliceRegion[],
    spacingPx: 5,
    radiusPx: 1000,
    pxPerRadian: 1000,
    totalBp,
    bpPerRadian: totalBp / (2 * Math.PI),
  }

  const slices = layoutSlices(view.elidedRegions, {
    radiansPerBp: 1 / view.bpPerRadian,
    gapRadians: view.spacingPx / view.radiusPx,
  })
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})
