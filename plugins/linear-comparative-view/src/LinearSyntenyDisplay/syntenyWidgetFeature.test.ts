import { syntenyWidgetFeature } from './syntenyWidgetFeature.ts'

import type { FeatPos } from './model.ts'

function feat(attributes: Record<string, number>): FeatPos {
  return {
    id: 'f1',
    strand: -1,
    name: 'gene1',
    refName: 'chr1',
    start: 100,
    end: 200,
    assemblyName: 'hg38',
    mate: { start: 300, end: 380, refName: 'chr2', assemblyName: 'mm10' },
    attributes,
  }
}

test('carries every numeric channel alongside the located fields', () => {
  expect(
    syntenyWidgetFeature(feat({ identity: 0.98, mappingQual: 60 })),
  ).toEqual({
    uniqueId: 'f1',
    strand: -1,
    name: 'gene1',
    refName: 'chr1',
    start: 100,
    end: 200,
    assemblyName: 'hg38',
    mate: { start: 300, end: 380, refName: 'chr2', assemblyName: 'mm10' },
    identity: 0.98,
    mappingQual: 60,
  })
})

// A channel name is a column name out of the track's own `attributeColumns`, so
// nothing stops one being called `start`. Spread last, it moved the feature the
// panel was describing — the panel named one locus and its "open in view" link
// another.
test('a channel named like a located field does not win', () => {
  const widget = syntenyWidgetFeature(
    feat({ start: 999, end: 999, refName: 999, uniqueId: 999 }),
  )
  expect(widget.start).toBe(100)
  expect(widget.end).toBe(200)
  expect(widget.refName).toBe('chr1')
  expect(widget.uniqueId).toBe('f1')
})
