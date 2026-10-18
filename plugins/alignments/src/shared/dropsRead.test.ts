import { dropsRead } from './util.ts'

function read(tags: Record<string, unknown>) {
  return {
    flags: 0,
    name: 'r1',
    cigarCategoryBits: 0,
    getTag: (tag: string) => tags[tag],
  }
}

const masks = { flagInclude: 0, flagExclude: 0 }

test('a tag value has to be the read’s, and an unset one passes any read carrying the tag', () => {
  const drops = dropsRead({
    ...masks,
    tags: [{ tag: 'HP', value: '1' }, { tag: 'RG' }],
  })
  expect(drops(read({ HP: 1, RG: 'lib1' }))).toBe(false)
  expect(drops(read({ HP: 2, RG: 'lib1' }))).toBe(true)
  expect(drops(read({ HP: 1 }))).toBe(true)
})

// the schema's default entry, which emptied the track
test('an entry naming no tag tests nothing', () => {
  expect(dropsRead({ ...masks, tags: [{ tag: '' }] })(read({}))).toBe(false)
})
