import { foldMultiWiggleRendering } from './retired.ts'

test.each([
  ['multirowxy', 'xyplot', 'source'],
  ['multirowdensity', 'density', 'source'],
  ['multirowline', 'line', 'source'],
  ['multirowlinecenter', 'linecenter', 'source'],
  ['multirowscatter', 'scatter', 'source'],
  ['multixyplot', 'xyplot', ''],
  ['multiline', 'line', ''],
  ['multilinecenter', 'linecenter', ''],
  ['multiscatter', 'scatter', ''],
  ['xyplot', 'xyplot', ''],
  ['line', 'line', ''],
  ['density', 'density', 'source'],
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
      rows: { domain: ['b', 'a'] },
    }),
  ).toEqual({
    defaultRendering: 'xyplot',
    rows: { domain: ['b', 'a'], field: 'source' },
  })
})

test.each(['multirowxy', 'multixyplot', 'density'])(
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
