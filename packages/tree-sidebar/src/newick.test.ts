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

// Variants' phased haplotype rows are named "<sample> HP<n>"; the label's space
// is load-bearing, since the hover highlight and subtree filter match leaf
// names against row names.
test('keeps spaces inside leaf labels', () => {
  expect(parseNewick('(NA18536 HP0,NA18748 HP1)1.5;')).toEqual({
    length: 1.5,
    children: [{ name: 'NA18536 HP0' }, { name: 'NA18748 HP1' }],
  })
})

test('ignores whitespace around delimiters and newlines between tokens', () => {
  expect(parseNewick('(\n  A:0.1,\n  B:0.2\n)F;')).toEqual({
    name: 'F',
    children: [
      { name: 'A', length: 0.1 },
      { name: 'B', length: 0.2 },
    ],
  })
})

test('parses unlabelled tree', () => {
  expect(parseNewick('((,),,(,));')).toEqual({
    children: [{ children: [{}, {}] }, {}, { children: [{}, {}] }],
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

test('treats trailing-zero numeric post-paren as length', () => {
  expect(parseNewick('(A,B)1.50;')).toEqual({
    length: 1.5,
    children: [{ name: 'A' }, { name: 'B' }],
  })
})

test('treats scientific-notation post-paren as length', () => {
  expect(parseNewick('(A,B)1e-3;')).toEqual({
    length: 1e-3,
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

// A bootstrap/support label sits exactly where hclust puts its merge height. A
// `:` anywhere in the string means phylo Newick, so the number is support, not
// a length — reading it as a length made assignCumulativeLengthY sum support
// values (often 0-100) into the branch distances and flatten the real ones.
test('reads a post-paren numeric as a name when the tree has : lengths', () => {
  expect(parseNewick('((A:0.1,B:0.2)95,(C:0.1,D:0.1)80);')).toEqual({
    children: [
      {
        name: '95',
        children: [
          { name: 'A', length: 0.1 },
          { name: 'B', length: 0.2 },
        ],
      },
      {
        name: '80',
        children: [
          { name: 'C', length: 0.1 },
          { name: 'D', length: 0.1 },
        ],
      },
    ],
  })
})
