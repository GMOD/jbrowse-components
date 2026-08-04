import { quoteName } from '@gmod/hclust'

import parseNewick from './newick.ts'

function leafNames(s: string) {
  const out: (string | undefined)[] = []
  ;(function walk(n: ReturnType<typeof parseNewick>) {
    if (n.children?.length) {
      for (const c of n.children) {
        walk(c)
      }
    } else {
      out.push(n.name)
    }
  })(parseNewick(s))
  return out
}

function roundTrip(names: string[]) {
  return leafNames(`(${names.map(quoteName).join(',')})1.2345;`)
}

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

test('leaves a label with no metacharacter unquoted', () => {
  expect(quoteName('GM12878')).toBe('GM12878')
  expect(quoteName('E003-H1_Cell_Line')).toBe('E003-H1_Cell_Line')
})

// A bare space is read as part of the label, so quoting it would change the
// serialized form of nearly every clustered track to fix nothing. `quoteName`
// is @gmod/hclust's, the writer this parser has to agree with — asserted here
// rather than restated, so a change on its side fails on ours.
test('leaves a label whose only special character is a space unquoted', () => {
  expect(quoteName('NA18536 HP0')).toBe('NA18536 HP0')
  expect(quoteName('Brain Angular Gyrus')).toBe('Brain Angular Gyrus')
  expect(roundTrip(['NA18536 HP0', 'NA18748 HP1'])).toEqual([
    'NA18536 HP0',
    'NA18748 HP1',
  ])
})

test('quotes a label carrying a metacharacter, doubling literal quotes', () => {
  expect(quoteName('cells (vHMEC)')).toBe("'cells (vHMEC)'")
  expect(quoteName('has, a comma')).toBe("'has, a comma'")
  expect(quoteName('chr1:100-200')).toBe("'chr1:100-200'")
  expect(quoteName("o'brien")).toBe("'o''brien'")
})

// Three of the Roadmap 127-epigenome names carry parentheses. Written bare, the
// parenthesis is grammar: `(BLD.CD4.NPC)` parsed back as an internal node
// wrapping a leaf of that name, so `treeDescribesRows` saw leaves that weren't
// the rows on screen and the dendrogram silently vanished behind StaleTreeHint.
test('round-trips a parenthesised label as one leaf', () => {
  const name =
    'Primary T helper naive cells from peripheral blood (BLD.CD4.NPC)'
  expect(roundTrip(['GM12878', name, 'K562'])).toEqual([
    'GM12878',
    name,
    'K562',
  ])
})

// Worse than the parenthesis case, because the tree comes back the wrong SHAPE:
// the comma splits one leaf into two, so every row below it is labeled with its
// neighbour's name rather than the tree just not drawing.
test('round-trips a label containing a comma as one leaf', () => {
  expect(roundTrip(['A', 'has, a comma', 'B'])).toEqual([
    'A',
    'has, a comma',
    'B',
  ])
})

test('round-trips a label containing a literal quote', () => {
  expect(roundTrip(['A', "o'brien", 'B'])).toEqual(['A', "o'brien", 'B'])
})

// A quoted colon must not flip the whole tree into the phylo reading, where a
// post-paren numeric is a bootstrap value rather than hclust's merge height.
test('a colon inside a quoted label leaves the tree in hclust form', () => {
  expect(parseNewick("('chr1:100-200','chr2:1-50')1.5;")).toEqual({
    length: 1.5,
    children: [{ name: 'chr1:100-200' }, { name: 'chr2:1-50' }],
  })
})

// Quoting is the writer saying "this is a label", which is the only way to name
// a node something that looks like a number.
test('treats a quoted post-paren numeric as a name, not a length', () => {
  expect(parseNewick("(A,B)'1.5';")).toEqual({
    name: '1.5',
    children: [{ name: 'A' }, { name: 'B' }],
  })
})

test('keeps whitespace inside a quoted label verbatim', () => {
  expect(parseNewick("('  padded  ',B)1.5;")).toEqual({
    length: 1.5,
    children: [{ name: '  padded  ' }, { name: 'B' }],
  })
})

// A supplied .nh guide tree (maf's `nhLocation`) is a hand-written file and may
// be pretty-printed. The layout whitespace around a quoted label is not part of
// the name, and a leaf whose name has a stray leading space matches no row.
test('drops layout whitespace around a quoted label', () => {
  expect(parseNewick("(\n  'A B' ,\n  'C D'\n)1.5;")).toEqual({
    length: 1.5,
    children: [{ name: 'A B' }, { name: 'C D' }],
  })
})
