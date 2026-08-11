import { SimpleFeature } from '@jbrowse/core/util'

import { dedupeFeaturesById } from './dedupeFeatures.ts'

import type { Feature } from '@jbrowse/core/util'

function feat(uniqueId: string, type = 'gene'): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgA',
    start: 0,
    end: 10,
    type,
  })
}

// One rule, three RPCs: the render pack, the multi-row pack and the clustering
// matrix each pay differently for a duplicate (a double-counted density gate,
// duplicate quads, double-counted bin coverage), and each used to spell this
// loop out beside a comment claiming it mirrored the others.
describe('dedupeFeaturesById', () => {
  it('keeps the first occurrence and preserves adapter order', () => {
    const first = feat('a')
    const map = dedupeFeaturesById([first, feat('b'), feat('a'), feat('c')])
    expect([...map.keys()]).toEqual(['a', 'b', 'c'])
    // first-wins, by identity — the later copy of `a` never replaces it, which
    // is what keeps a re-fetch of the same region packing the same order
    expect(map.get('a')).toBe(first)
  })

  it('applies the admission predicate inside the dedup, so size is the admitted count', () => {
    const map = dedupeFeaturesById(
      [feat('a', 'gene'), feat('b', 'exon'), feat('a', 'gene')],
      f => f.get('type') === 'gene',
    )
    // the render RPC reports this size as its featureCount and gates the density
    // banner on it, so a rejected feature must not be counted
    expect(map.size).toBe(1)
    expect([...map.keys()]).toEqual(['a'])
  })

  // A rejected id must not occupy the slot: without the ordering below, an
  // early rejected copy would mark the id seen and drop an admitted later one.
  it('does not let a rejected feature block a later admitted one with the same id', () => {
    let calls = 0
    const map = dedupeFeaturesById([feat('a'), feat('a')], () => {
      calls++
      return calls > 1
    })
    expect([...map.keys()]).toEqual(['a'])
  })

  it('admits everything when no predicate is given', () => {
    expect(dedupeFeaturesById([feat('a'), feat('b')]).size).toBe(2)
  })
})
