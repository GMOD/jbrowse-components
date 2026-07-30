import { initKeyProblems, splitLaunchSpec } from './initKeys.ts'

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

test('inside init, a view prop and a typo get told apart', () => {
  expect(
    initKeyProblems({ assembly: 'volvox', colorByCDS: true, highlights: [] }),
  ).toEqual({ viewProps: ['colorByCDS'], unknown: ['highlights'] })
})
