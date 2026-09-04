import { parentFeatureSummary } from './openFeatureWidget.ts'
import SimpleFeature from './simpleFeature.ts'

// A gene as the details path meets one: the click resolves an isoform id, the
// display walks `subfeatures` to reach it, and what it hands the widget is the
// inflated child -- which knows its parent only through the handle its
// construction gave it. Serializing it would keep the parent's id and lose this.
const gene = (data: Record<string, unknown>) =>
  new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'mRNA1',
        refName: 'ctgA',
        start: 0,
        end: 100,
        type: 'mRNA',
        name: 'BRCA1-201',
      },
    ],
    ...data,
  })

const isoformOf = (f: SimpleFeature) => f.get('subfeatures')![0]!

test('parentFeatureSummary names the gene an isoform hangs off', () => {
  expect(
    parentFeatureSummary(isoformOf(gene({ name: 'BRCA1' })).parent!()),
  ).toEqual({
    name: 'BRCA1',
    type: 'gene',
  })
})

// `generateTitle` heads the card with the same fallback, so a gene the file
// named only by id is named the same way in both places.
test('parentFeatureSummary falls back to the id of an unnamed parent', () => {
  expect(
    parentFeatureSummary(isoformOf(gene({ id: 'ENSG00000012048' })).parent!()),
  ).toEqual({
    name: 'ENSG00000012048',
    type: 'gene',
  })
})

// "in gene" is less than nothing.
test('parentFeatureSummary summarizes a nameless parent to nothing', () => {
  expect(parentFeatureSummary(isoformOf(gene({})).parent!())).toBeUndefined()
})

test('parentFeatureSummary has nothing to say about a top-level feature', () => {
  expect(parentFeatureSummary(gene({ name: 'BRCA1' }).parent())).toBeUndefined()
})
