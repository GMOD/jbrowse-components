import { renameRefNameDict } from './renameRefNameDict.ts'

test('renames the entries a map names', () => {
  const { dict, ids } = renameRefNameDict({
    dict: ['1', '2'],
    ids: new Uint32Array([0, 1, 0]),
    map: { '1': 'chr1', '2': 'chr2' },
  })
  expect(dict).toEqual(['chr1', 'chr2'])
  expect([...ids]).toEqual([0, 1, 0])
})

// The identity case, which is every config we ship: the file and the assembly
// agree, so `loadRefNameMap` builds an identity map and this has to be a no-op
// rather than a wrong answer.
test('leaves a name the map does not hold alone', () => {
  const { dict } = renameRefNameDict({
    dict: ['ctgA', 'ctgB'],
    ids: new Uint32Array([0, 1]),
    map: { ctgA: 'ctgA' },
  })
  expect(dict).toEqual(['ctgA', 'ctgB'])
})

// The reason this is not a `.map()` in place. `pickFollowFeature` and
// `followWindowMapping` both resolve a name to an id ONCE with `dict.indexOf`
// and then compare integers, so a duplicated entry would silently stop matching
// every feature carrying the second id.
test('re-interns when two spellings collapse onto one canonical name', () => {
  const { dict, ids } = renameRefNameDict({
    dict: ['chr1', '1', 'chr2'],
    ids: new Uint32Array([0, 1, 2, 1]),
    map: { chr1: 'chr1', '1': 'chr1', chr2: 'chr2' },
  })
  expect(dict).toEqual(['chr1', 'chr2'])
  expect([...ids]).toEqual([0, 0, 1, 0])
  expect(dict.indexOf('chr1')).toBe(0)
})

// The ids array is per-feature and this runs once per fetch, so the ordinary
// case must not pay a pass over it. Ids are handed out in first-seen order, so
// they are only disturbed by a collapse.
test('hands back the same ids array when nothing collapsed', () => {
  const ids = new Uint32Array([0, 1])
  expect(
    renameRefNameDict({
      dict: ['1', '2'],
      ids,
      map: { '1': 'chr1', '2': 'chr2' },
    }).ids,
  ).toBe(ids)
})
