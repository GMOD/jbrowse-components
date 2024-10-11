import { calculateStaticSlices } from './slices'

test('one slice', () => {
  const view = {
    elidedRegions: [{ refName: 'toast', start: 0, end: 10000, widthBp: 10000 }],
    spacingPx: 5,
    radiusPx: 1000,
    totalBp: 10000,
    bpPerRadian: 10000 / (2 * Math.PI),
    pxPerRadian: 1000,
  }

  // @ts-expect-error
  const slices = calculateStaticSlices(view)
  expect(slices.length).toBe(1)
  const [slice] = slices
  expect(slice).toMatchSnapshot()
})

test('two slices', () => {
  const view = {
    elidedRegions: [
      {
        elided: true,
        assemblyName: 'wow',
        refName: 'toast',
        start: 0,
        end: 10000,
        widthBp: 10000,
      },
      {
        elided: true,
        assemblyName: 'wow',
        refName: 'test',
        start: 0,
        end: 10000,
        widthBp: 10000,
      },
    ],
    spacingPx: 5,
    radiusPx: 1000,
    pxPerRadian: 1000,
    totalBp: 20000,
    bpPerRadian: 20000 / (2 * Math.PI),
  }

  // @ts-expect-error
  const slices = calculateStaticSlices(view)
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})

test('volvox', () => {
  const totalBp = 50001 + 6079
  const view = {
    elidedRegions: [
      {
        refName: 'ctgA',
        start: 0,
        end: 50001,
        assemblyName: 'volvox',
        widthBp: 50001,
      },
      {
        refName: 'ctgB',
        start: 0,
        end: 6079,
        assemblyName: 'volvox',
        widthBp: 6079,
      },
    ],
    spacingPx: 5,
    radiusPx: 1000,
    pxPerRadian: 1000,
    totalBp,
    bpPerRadian: totalBp / (2 * Math.PI),
  }

  // @ts-expect-error
  const slices = calculateStaticSlices(view)
  expect(slices.length).toBe(2)
  expect(slices).toMatchSnapshot()
})
