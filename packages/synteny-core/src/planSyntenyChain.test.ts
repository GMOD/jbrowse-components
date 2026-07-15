import { planSyntenyChain } from './planSyntenyChain.ts'

// build an isConnected predicate from an undirected edge list
function edges(pairs: [string, string][]) {
  const keys = new Set(pairs.flatMap(([a, b]) => [`${a}\0${b}`, `${b}\0${a}`]))
  return (a: string, b: string) => keys.has(`${a}\0${b}`)
}

test('leaves 2 assemblies untouched', () => {
  expect(planSyntenyChain(['a', 'b'], () => true)).toEqual(['a', 'b'])
})

test('reorders a scrambled path into a connected chain', () => {
  // path a-b-c-d given out of order; every adjacent pair should be connected
  const chain = planSyntenyChain(
    ['a', 'c', 'b', 'd'],
    edges([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
    ]),
  )
  for (let i = 0; i < chain.length - 1; i++) {
    expect(
      edges([
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'd'],
      ])(chain[i]!, chain[i + 1]!),
    ).toBe(true)
  }
})

test('puts a hub in the middle of a star (3 connected pairs max)', () => {
  // ref connects to x, y, z; best possible chain is leaf-ref-leaf
  const chain = planSyntenyChain(
    ['x', 'y', 'ref', 'z'],
    edges([
      ['ref', 'x'],
      ['ref', 'y'],
      ['ref', 'z'],
    ]),
  )
  expect(chain[1]).toBe('ref')
  expect(chain).toHaveLength(4)
})

test('keeps unconnected assemblies rather than dropping them', () => {
  const chain = planSyntenyChain(['a', 'b', 'orphan'], edges([['a', 'b']]))
  expect([...chain].sort()).toEqual(['a', 'b', 'orphan'])
  expect(chain).toHaveLength(3)
})
