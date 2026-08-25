import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { UNLABELED_GROUP } from './variantLegend.ts'

function display() {
  const { display } = createTestEnvironment().createDisplay()
  display.setColorBy('population')
  display.setSources([
    { name: 'S0', population: 'AFR' },
    { name: 'S1', population: 'EUR' },
    { name: 'S2', population: 'AFR' },
    { name: 'S3' },
  ])
  return display
}

// Clicking a group's swatch in the legend narrows the rows to that group, the
// same write a tree-node click makes, so the sidebar's "Showing N rows" chip
// and "Clear subtree filter" are the way back.
test('focuses the rows of a colorBy group by its legend label', () => {
  const d = display()
  d.focusGroup('AFR')
  expect(d.sources.map(s => s.name)).toEqual(['S0', 'S2'])
  expect(d.subtreeFilter).toEqual(['S0', 'S2'])
})

test('the unlabeled group is the rows with no value', () => {
  const d = display()
  d.focusGroup(UNLABELED_GROUP)
  expect(d.sources.map(s => s.name)).toEqual(['S3'])
})
