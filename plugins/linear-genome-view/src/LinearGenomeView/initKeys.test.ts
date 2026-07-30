import { partitionLaunchKeys } from './initKeys.ts'

test('resolution keys go to init, plain view props go to the snapshot', () => {
  expect(
    partitionLaunchKeys({
      assembly: 'volvox',
      loc: 'ctgA:1-100',
      tracks: ['genes'],
      colorByCDS: true,
      trackLabels: 'offset',
    }),
  ).toEqual({
    init: { assembly: 'volvox', loc: 'ctgA:1-100', tracks: ['genes'] },
    viewProps: { colorByCDS: true, trackLabels: 'offset' },
    unknown: {},
  })
})

// the launcher warns on these; afterAttach warns on the ones that reach a frozen
// init blob. Both need the values kept, not just the names, since the blob is
// rebuilt from the buckets
test('a typo lands in neither bucket so the caller can report it', () => {
  const { init, viewProps, unknown } = partitionLaunchKeys({
    assembly: 'volvox',
    tracksList: true,
    colorByCds: true,
  })
  expect(init).toEqual({ assembly: 'volvox' })
  expect(viewProps).toEqual({})
  expect(unknown).toEqual({ tracksList: true, colorByCds: true })
})
