import { parseNewick } from '@gmod/newick'

import {
  newickLeafNames,
  rotateNewickByDomain,
} from './rotateNewickByDomain.ts'

import type { NewickNode } from '@gmod/newick'

const FOUR = '((A,B),(C,D));'

function rotate(newick: string, domain: string[]) {
  return newickLeafNames(rotateNewickByDomain(parseNewick(newick), domain))
}

describe('a domain rotates the tree rather than reordering against it', () => {
  it('brings the listed leaf forward with its clade', () => {
    expect(rotate(FOUR, ['C'])).toEqual(['C', 'D', 'A', 'B'])
  })

  // The distinguishing case, and the one the slot descriptions quote: a flat
  // reorder would give B,C,D,A. A rotation cannot separate A from B, so A rides
  // along in second place and the dendrogram still draws.
  it('honours the order only as far as the topology allows', () => {
    expect(rotate(FOUR, ['B', 'C', 'D'])).toEqual(['B', 'A', 'C', 'D'])
  })

  it('orders leaves in different clades by their own earliest index', () => {
    expect(rotate(FOUR, ['D', 'B'])).toEqual(['D', 'C', 'B', 'A'])
  })

  it('leaves the tree alone for a name matching no leaf', () => {
    expect(rotate(FOUR, ['rn6'])).toEqual(['A', 'B', 'C', 'D'])
  })

  it('places a repeated name once, at its first index', () => {
    expect(rotate(FOUR, ['D', 'B', 'D'])).toEqual(rotate(FOUR, ['D', 'B']))
  })

  // Stability is what lets an unlisted clade come back: the rotation is derived
  // from the current domain every time, so emptying it restores file order only
  // if nothing was sorted along the way.
  it('keeps clades holding no listed leaf in the order they were written', () => {
    expect(rotate('(((A,B),(C,D)),(E,F));', ['E'])).toEqual([
      'E',
      'F',
      'A',
      'B',
      'C',
      'D',
    ])
  })

  // `parsedTree` is cached per newick string, so an in-place sort would compound
  // across domain changes. Returning the input unrotated for an empty domain
  // would pass an equality check and hide exactly that.
  it('never hands back the tree it was given', () => {
    const parsed = parseNewick(FOUR)
    const rotated = rotateNewickByDomain(parsed, [])
    expect(rotated).toEqual(parsed)
    expect(rotated).not.toBe(parsed)
    expect(rotated.children![0]).not.toBe(parsed.children![0])
  })

  it('leaves the tree it was given unmutated', () => {
    const parsed = parseNewick(FOUR)
    rotateNewickByDomain(parsed, ['D', 'B'])
    expect(newickLeafNames(parsed)).toEqual(['A', 'B', 'C', 'D'])
  })

  // The shape this package exists to draw: a single-linkage dendrogram is a
  // caterpillar whose depth is its leaf count, and the recursive form throws
  // past about 5000 tips.
  it('rotates a caterpillar deeper than the call stack', () => {
    const TIPS = 6000
    let deep: NewickNode = { name: 'l0' }
    for (let i = 1; i < TIPS; i++) {
      deep = { name: `i${i}`, length: 1, children: [deep, { name: `l${i}` }] }
    }
    const names = newickLeafNames(rotateNewickByDomain(deep, ['l0']))
    expect(names).toHaveLength(TIPS)
    expect(names[0]).toBe('l0')
  })
})
