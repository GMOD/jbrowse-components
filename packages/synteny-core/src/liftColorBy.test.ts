import { liftColorBy } from './liftColorBy.ts'

// a v4 share link holds the mode string, and a session saved in the week the
// views held the colour object under `colorBy` holds that
test('a v4 mode string lifts into the field it paints', () => {
  expect(liftColorBy({ colorBy: 'strand' })).toEqual({
    color: { field: 'strand' },
  })
  expect(liftColorBy({ colorBy: 'mappingQuality' })).toEqual({
    color: { field: 'mappingQual' },
  })
  expect(liftColorBy({ colorBy: 'meanQueryIdentity' })).toEqual({
    color: { field: 'identity' },
  })
  expect(liftColorBy({ colorBy: 'default' })).toEqual({ color: undefined })
})

test('a column mode keeps the order its colorDomain gave it', () => {
  expect(
    liftColorBy({
      colorBy: 'attribute:gene_group',
      colorDomain: ['B1', 'A1a'],
    }),
  ).toEqual({ color: { field: 'gene_group', domain: ['B1', 'A1a'] } })
})

test('the colour object and a colour string pass through under the new name', () => {
  expect(liftColorBy({ colorBy: { field: 'query' } })).toEqual({
    color: { field: 'query' },
  })
  expect(liftColorBy({ colorBy: 'grey' })).toEqual({ color: 'grey' })
})

test('a v4 init blob lifts too, and a snapshot with neither is left alone', () => {
  expect(liftColorBy({ init: { colorBy: 'dnds' } })).toEqual({
    init: { color: { field: 'dnds' } },
  })
  const snap = { color: { field: 'track' }, init: { views: [] } }
  expect(liftColorBy(snap)).toBe(snap)
})
