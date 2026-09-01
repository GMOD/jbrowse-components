import { hasIdAttribute } from './hasIdAttribute.ts'

const line = (attrs: string) => `chr1\tRefSeq\tgene\t1\t2\t.\t+\t.\t${attrs}`

test('a record carrying ID can be a Parent target', () => {
  expect(hasIdAttribute(line('ID=gene-A;Name=A'))).toBe(true)
  expect(hasIdAttribute(line('Name=A;ID=gene-A'))).toBe(true)
  expect(hasIdAttribute(line('Name=A;ID=gene-A;Parent=x'))).toBe(true)
})

// The shape this exists for: NCBI's assembly-alignment record spans most of the
// chromosome, its type is in nobody's blocklist, and it has no ID — so nothing
// references it, so it has no children, so it owes no redispatch.
test('a record with no ID cannot be one', () => {
  expect(
    hasIdAttribute(
      'chr1\tRefSeq\tmatch\t585989\t121976459\t.\t+\t.\t' +
        'Target=chr1 585989 121976459 +;gap_count=0;pct_identity_gap=100',
    ),
  ).toBe(false)
  expect(hasIdAttribute(line('Parent=gene-A'))).toBe(false)
  expect(hasIdAttribute(line('.'))).toBe(false)
})

// The two errors are not symmetric, so the anchoring is deliberate both ways: a
// false positive only widens the bound to what it is today, while a false
// negative drops a flank a feature's children are in.
test('anchors on the separator rather than matching anywhere', () => {
  // an attribute merely ending in ID is not one
  expect(hasIdAttribute(line('geneID=7157;Name=TP53'))).toBe(false)
  // nor is an ID= sitting inside another attribute's value
  expect(hasIdAttribute(line('Note=see ID=other'))).toBe(false)
  // but space after the separator is real-world GFF3 and must still match,
  // since missing one is the error that costs a rendering
  expect(hasIdAttribute(line('Name=A; ID=gene-A'))).toBe(true)
})
