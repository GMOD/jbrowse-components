import { renameDictLane } from './renameDictLane.ts'

// stands in for `getCanonicalRefNameFn`'s resolver: the assembly's alias table,
// which is total and answers identity for a name it does not know
const canonicalizer = (aliases: Record<string, string>) => (name: string) =>
  aliases[name] ?? name

test('renames the entries the assembly knows an alias for', () => {
  const { dict, ids } = renameDictLane({
    dict: ['1', '2'],
    ids: new Uint32Array([0, 1, 0]),
    canonical: canonicalizer({ '1': 'chr1', '2': 'chr2' }),
  })
  expect(dict).toEqual(['chr1', 'chr2'])
  expect([...ids]).toEqual([0, 1, 0])
})

// The identity case, which is every config we ship: the file and the assembly
// agree, so this has to be a no-op rather than a wrong answer.
test('leaves a name with no alias alone', () => {
  const { dict } = renameDictLane({
    dict: ['ctgA', 'ctgB'],
    ids: new Uint32Array([0, 1]),
    canonical: canonicalizer({}),
  })
  expect(dict).toEqual(['ctgA', 'ctgB'])
})

// The reason this is not a `.map()` in place, and the shape a collapse actually
// takes: ONE aliased spelling is enough, because the canonical name it resolves
// to is a name the same file also uses, which passes through unchanged.
// `pickFollowFeature` and `followWindowMapping` both resolve a name to an id
// once with `dict.indexOf` and then compare integers, so a duplicated entry
// would silently stop matching every feature carrying the second id.
test('re-interns when an aliased spelling collapses onto one already present', () => {
  const { dict, ids } = renameDictLane({
    dict: ['chr1', '1', 'chr2'],
    ids: new Uint32Array([0, 1, 2, 1]),
    canonical: canonicalizer({ chr1: '1', chr2: '2' }),
  })
  expect(dict).toEqual(['1', '2'])
  expect([...ids]).toEqual([0, 0, 1, 0])
  expect(dict.indexOf('1')).toBe(0)
})

// The map the collapse was applied through, for the lanes this function cannot
// see: a payload can key more than one array by these ids, and one of them
// (`OffscreenMateData.counts`) is per-contig rather than per-feature, so it has
// to be SUMMED across a collapse rather than reindexed.
test('reports the old id -> new id map', () => {
  expect(
    renameDictLane({
      dict: ['chr1', '1', 'chr2'],
      ids: new Uint32Array([0]),
      canonical: canonicalizer({ chr1: '1', chr2: '2' }),
    }).remap,
  ).toEqual([0, 0, 1])
})

test('...and reports it when nothing collapsed too', () => {
  expect(
    renameDictLane({
      dict: ['1', '2'],
      ids: new Uint32Array([0, 1]),
      canonical: canonicalizer({ '1': 'chr1' }),
    }).remap,
  ).toEqual([0, 1])
})

// The ids array is per-feature and this runs once per fetch, so the ordinary
// case must not pay a pass over it. Ids are handed out in first-seen order, so
// they are only disturbed by a collapse.
test('hands back the same ids array when nothing collapsed', () => {
  const ids = new Uint32Array([0, 1])
  expect(
    renameDictLane({
      dict: ['1', '2'],
      ids,
      canonical: canonicalizer({ '1': 'chr1', '2': 'chr2' }),
    }).ids,
  ).toBe(ids)
})
