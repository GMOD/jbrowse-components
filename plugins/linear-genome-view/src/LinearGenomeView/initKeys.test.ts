import { splitLaunchSpec, unknownInitKeys } from './initKeys.ts'

test('resolution keys go to init, plain view props go to the snapshot', () => {
  expect(
    splitLaunchSpec({
      assembly: 'volvox',
      loc: 'ctgA:1-100',
      tracks: ['genes'],
      colorByCDS: true,
      trackLabels: 'offset',
    }),
  ).toEqual({
    init: { assembly: 'volvox', loc: 'ctgA:1-100', tracks: ['genes'] },
    viewProps: { colorByCDS: true, trackLabels: 'offset' },
    unknown: [],
  })
})

test('a typo lands in neither bucket so the caller can report it', () => {
  const { init, viewProps, unknown } = splitLaunchSpec({
    assembly: 'volvox',
    tracksList: true,
    colorByCds: true,
  })
  expect(init).toEqual({ assembly: 'volvox' })
  expect(viewProps).toEqual({})
  expect(unknown).toEqual(['tracksList', 'colorByCds'])
})

test('a plain view prop inside init is flagged, since MST would drop it', () => {
  expect(unknownInitKeys({ assembly: 'volvox', colorByCDS: true })).toEqual([
    'colorByCDS',
  ])
})
