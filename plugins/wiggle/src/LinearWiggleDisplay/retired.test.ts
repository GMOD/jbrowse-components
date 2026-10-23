import { foldMultiWiggleRendering, retiredState } from './retired.ts'

test.each([
  ['multirowxy', 'xyplot', 'source'],
  ['multirowdensity', 'density', 'source'],
  ['multirowline', 'line', 'source'],
  ['multiline', 'line', ''],
  ['xyplot', 'xyplot', ''],
])('the multi display’s %s is %s with rows %j', (old, plot, rows) => {
  expect(foldMultiWiggleRendering({ defaultRendering: old })).toEqual({
    defaultRendering: plot,
    rows,
  })
})

test('the layout joins an arrangement already lifted', () => {
  expect(
    foldMultiWiggleRendering({
      defaultRendering: 'multirowxy',
      rows: { sort: ['b', 'a'] },
    }),
  ).toEqual({
    defaultRendering: 'xyplot',
    rows: { sort: ['b', 'a'], field: 'source' },
  })
})

test.each(['multirowxy', 'multiline', 'multirowdensity'])(
  'folding a folded %s entry changes nothing',
  rendering => {
    const once = foldMultiWiggleRendering({ defaultRendering: rendering })
    expect(foldMultiWiggleRendering(once)).toEqual(once)
  },
)

test('an entry with no rendering is left alone', () => {
  const entry = { height: 300 }
  expect(foldMultiWiggleRendering(entry)).toBe(entry)
})

test.each([
  ['avg', 'score', 'none'],
  ['max', 'maxScore', 'none'],
  ['whiskers', 'score', 'min-max'],
])(
  'a v4 session’s summaryScoreMode %s is y %s, extent %s',
  (mode, field, extent) => {
    expect(retiredState.lift({ summaryScoreMode: mode })).toMatchObject({
      encoding: { y: { field } },
      extent,
    })
    expect(retiredState.keys).toContain('summaryScoreMode')
  },
)

test('a v4 session’s resolution is data.resolution', () => {
  expect(retiredState.lift({ resolution: 5 })).toMatchObject({
    data: { resolution: 5 },
  })
  expect(retiredState.lift({ resolution: 5 })).not.toHaveProperty('resolution')
})
