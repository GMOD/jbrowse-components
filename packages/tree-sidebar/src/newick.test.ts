import parseNewick from './newick.ts'

test('parses simple newick with branch lengths', () => {
  expect(parseNewick('(A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5)F;')).toEqual({
    name: 'F',
    children: [
      { name: 'A', length: 0.1 },
      { name: 'B', length: 0.2 },
      {
        name: 'E',
        length: 0.5,
        children: [
          { name: 'C', length: 0.3 },
          { name: 'D', length: 0.4 },
        ],
      },
    ],
  })
})

test('parses unlabelled tree', () => {
  expect(parseNewick('((,),,(,));')).toEqual({
    children: [
      { children: [{}, {}] },
      {},
      { children: [{}, {}] },
    ],
  })
})

test('treats numeric post-paren label as length (hclust serialization)', () => {
  expect(parseNewick('(A,B)1.5;')).toEqual({
    length: 1.5,
    children: [{ name: 'A' }, { name: 'B' }],
  })
})

test('treats non-numeric post-paren label as name', () => {
  expect(parseNewick('(A,B)Internal;')).toEqual({
    name: 'Internal',
    children: [{ name: 'A' }, { name: 'B' }],
  })
})

test('parses internal node name plus colon branch length', () => {
  expect(parseNewick('(A:1,B:2)Root:5;')).toEqual({
    name: 'Root',
    length: 5,
    children: [
      { name: 'A', length: 1 },
      { name: 'B', length: 2 },
    ],
  })
})
