import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
} from './testUtils.ts'

const NO_VALUE_NOTICE =
  'facet: no read here carries a value for insertSizeAndOrientation, so every read is in one section'

function facetedDisplay(keys: string[]) {
  const { display } = createTestAlignmentsDisplay()
  display.facetByField('insertSizeAndOrientation')
  display.setRpcData(
    0,
    {
      groups: keys.map(key => ({
        key,
        label: key,
        data: makeEmptyPileupData(),
      })),
    },
    { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
  )
  return display
}

test('a facet no fetched read answers puts every read in one section', () => {
  expect(facetedDisplay(['']).liveNotices).toEqual([NO_VALUE_NOTICE])
})

test('hiding every valued lane does not claim no read carries a value', () => {
  const display = facetedDisplay(['', 'LR'])
  display.hideGroup('LR')
  expect(display.groupOrder.map(g => g.key)).toEqual([''])
  expect(display.liveNotices).toEqual([])
})
