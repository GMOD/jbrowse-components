import { quoteName } from '@gmod/hclust'
import { parseNewick } from '@gmod/newick'

// The parser's own coverage lives in @gmod/newick. What is left here is the
// pairing this package depends on and that package cannot test: @gmod/hclust
// writes the newick and @gmod/newick reads it, so the two have to agree exactly,
// and tree-sidebar relies on the default post-paren reading resolving to
// hclust's merge height rather than to a bootstrap value.

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

test('reads hclust serialization: numeric post-paren is a merge height', () => {
  expect(parseNewick('(A,B)1.5;')).toEqual({
    length: 1.5,
    children: [{ name: 'A' }, { name: 'B' }],
  })
})

// A bootstrap/support label sits exactly where hclust puts its merge height. A
// `:` anywhere means phylo newick, so the number is support, not a length —
// reading it as a length made assignCumulativeLengthY sum support values (often
// 0-100) into the branch distances and flatten the real ones.
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

// A quoted colon must not flip the whole tree into the phylo reading.
test('a colon inside a quoted label leaves the tree in hclust form', () => {
  expect(parseNewick("('chr1:100-200','chr2:1-50')1.5;")).toEqual({
    length: 1.5,
    children: [{ name: 'chr1:100-200' }, { name: 'chr2:1-50' }],
  })
})

test('leaves a label with no metacharacter unquoted', () => {
  expect(quoteName('GM12878')).toBe('GM12878')
  expect(quoteName('E003-H1_Cell_Line')).toBe('E003-H1_Cell_Line')
})

// A bare space is read as part of the label, so quoting it would change the
// serialized form of nearly every clustered track to fix nothing. Variants'
// phased rows are named `NA18536 HP0`, and the space is load-bearing since hover
// and subtree filtering match leaf names against row names.
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
