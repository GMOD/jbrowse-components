import { foldMultiWiggleRendering } from './retired.ts'

test.each([
  ['multirowxy', 'xyplot', 'source'],
  ['multirowdensity', 'density', 'source'],
  ['multirowline', 'line', 'source'],
  ['multiline', 'line', ''],
  ['xyplot', 'xyplot', ''],
  ['multixyplot', 'xyplot', ''],
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
