import { calculateStaticSlices } from './slices'

test('one slice', () => {
  const view = {
    bpPerRadian: 10000 / (2 * Math.PI),
    elidedRegions: [{ end: 10000, refName: 'toast', start: 0, widthBp: 10000 }],
    pxPerRadian: 1000,
    radiusPx: 1000,
    spacingPx: 5,
    totalBp: 10000,
  }

  const slices = calculateStaticSlices(view)
  // console.log(slices)
  expect(slices.length).toBe(1)
  const [slice] = slices
  // expect(slices).toMatchSnapshot()
  expect(slice).toMatchSnapshot()
})

test('two slices', () => {
  const view = {
    bpPerRadian: 20000 / (2 * Math.PI),
    elidedRegions: [
      { end: 10000, refName: 'toast', start: 0, widthBp: 10000 },
      { end: 10000, refName: 'teest', start: 0, widthBp: 10000 },
    ],
    pxPerRadian: 1000,
    radiusPx: 1000,
    spacingPx: 5,
    totalBp: 20000,
  }

  const slices = calculateStaticSlices(view)
  // console.log(slices)
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})

test('volvox', () => {
  const totalBp = 50001 + 6079
  const view = {
    bpPerRadian: totalBp / (2 * Math.PI),
    elidedRegions: [
      {
        assemblyName: 'volvox',
        end: 50001,
        refName: 'ctgA',
        start: 0,
        widthBp: 50001,
      },
      {
        assemblyName: 'volvox',
        end: 6079,
        refName: 'ctgB',
        start: 0,
        widthBp: 6079,
      },
    ],
    pxPerRadian: 1000,
    radiusPx: 1000,
    spacingPx: 5,
    totalBp,
  }

  const slices = calculateStaticSlices(view)
  // console.log(slices)
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})
