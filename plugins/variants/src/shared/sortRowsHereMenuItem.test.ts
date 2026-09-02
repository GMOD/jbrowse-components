import { SimpleFeature } from '@jbrowse/core/util'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The right-click sort row comes from the shared `sortRowsHereMenuItem`, the
// same helper wiggle, canvas and maf take: one label shape and one "needs two
// rows" gate across the four displays that order rows at a column. This display
// had hand-written its own, so it offered a sort on a single-sample track that
// `sortByGenotype` then declined to run.
function sortRow(sources: { name: string }[]) {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(sources)
  display.openContextMenu({
    feature: new SimpleFeature({
      uniqueId: 'v1',
      refName: 'ctgA',
      start: 100,
      end: 101,
    }),
    clientX: 0,
    clientY: 0,
  })
  const row = display
    .contextMenuItems()
    .find(i => 'label' in i && i.label === 'Sort rows by genotype here')
  if (!row) {
    throw new Error('no "Sort rows by genotype here" row')
  }
  return row as MenuItem & { disabled?: boolean; disabledHelpText?: string }
}

test('offers the sort once there are two rows to order', () => {
  expect(sortRow([{ name: 'S0' }, { name: 'S1' }]).disabled).toBe(false)
})

test('a single row is disabled with the shared wording', () => {
  const row = sortRow([{ name: 'S0' }])
  expect(row.disabled).toBe(true)
  expect(row.disabledHelpText).toBe('Needs at least two rows to sort')
})
