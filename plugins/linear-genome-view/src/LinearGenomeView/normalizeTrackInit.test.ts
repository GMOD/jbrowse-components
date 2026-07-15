import { normalizeTrackInit } from './normalizeTrackInit.ts'

test('bare string', () => {
  expect(normalizeTrackInit('t1')).toEqual({
    trackId: 't1',
    trackSnapshot: {},
    displaySnapshot: {},
  })
})

test('inline display props fold into the display snapshot', () => {
  expect(
    normalizeTrackInit({
      trackId: 't1',
      type: 'LinearBasicDisplay',
      showDescriptions: false,
    }),
  ).toEqual({
    trackId: 't1',
    trackSnapshot: {},
    displaySnapshot: { type: 'LinearBasicDisplay', showDescriptions: false },
  })
})

test('legacy nested displaySnapshot still works', () => {
  expect(
    normalizeTrackInit({
      trackId: 't1',
      displaySnapshot: { type: 'LinearBasicDisplay', showDescriptions: false },
    }),
  ).toEqual({
    trackId: 't1',
    trackSnapshot: {},
    displaySnapshot: { type: 'LinearBasicDisplay', showDescriptions: false },
  })
})

test('explicit displaySnapshot wins over an inline key of the same name', () => {
  expect(
    normalizeTrackInit({
      trackId: 't1',
      height: 50,
      displaySnapshot: { height: 100 },
    }),
  ).toEqual({
    trackId: 't1',
    trackSnapshot: {},
    displaySnapshot: { height: 100 },
  })
})

test('trackSnapshot escape hatch is kept separate from display props', () => {
  expect(
    normalizeTrackInit({
      trackId: 't1',
      trackSnapshot: { foo: 1 },
      height: 50,
    }),
  ).toEqual({
    trackId: 't1',
    trackSnapshot: { foo: 1 },
    displaySnapshot: { height: 50 },
  })
})
