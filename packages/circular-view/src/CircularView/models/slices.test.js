import * as util from '@gmod/jbrowse-core/util'
import F from './calculateStaticSlices'

const calculateStaticSlices = F({
  jbrequire: () => util,
})

test('one slice', () => {
  const view = {
    displayedRegions: [{ refName: 'toast', start: 0, end: 10000 }],
    spacingPx: 5,
    radiusPx: 1000,
    totalBp: 10000,
    bpPerRadian: 10000 / (2 * Math.PI),
  }

  const slices = calculateStaticSlices(view)
  // console.log(slices)
  expect(slices.length).toBe(1)
  const [slice] = slices
  expect(slice.spacingOffset.x).toBeCloseTo(0)
  expect(slice.spacingOffset.y).toBeCloseTo(0)
  // expect(slices).toMatchSnapshot()
  expect(slice).toMatchSnapshot()
})

test('two slices', () => {
  const view = {
    displayedRegions: [
      { refName: 'toast', start: 0, end: 10000 },
      { refName: 'teest', start: 0, end: 10000 },
    ],
    spacingPx: 5,
    radiusPx: 1000,
    totalBp: 20000,
    bpPerRadian: 20000 / (2 * Math.PI),
  }

  const slices = calculateStaticSlices(view)
  // console.log(slices)
  expect(slices.length).toBe(2)
  expect(slices[0].spacingOffset.x).toBeCloseTo(0)
  expect(slices[0].spacingOffset.y).toBeCloseTo(3.535)
  expect(slices).toMatchSnapshot()
})

test('volvox', () => {
  const totalBp = 50001 + 6079
  const view = {
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 50001, assemblyName: 'volvox' },
      { refName: 'ctgB', start: 0, end: 6079, assemblyName: 'volvox' },
    ],
    spacingPx: 5,
    radiusPx: 1000,
    totalBp,
    bpPerRadian: totalBp / (2 * Math.PI),
  }

  const slices = calculateStaticSlices(view)
  // console.log(slices)
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})
