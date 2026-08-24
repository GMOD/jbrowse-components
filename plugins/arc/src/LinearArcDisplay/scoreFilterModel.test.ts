import { SimpleFeature } from '@jbrowse/core/util'

import { createTestEnvironment } from '../shared/testEnv.ts'

import type { Feature } from '@jbrowse/core/util'

const { createDisplay } = createTestEnvironment({
  thickness: 2,
  label: 'arc',
  caption: 'arc',
})

function feat(uniqueId: string, score?: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgA',
    start: 100,
    end: 2000,
    ...(score === undefined ? {} : { score }),
  })
}

function scoreFilterRow(display: ReturnType<typeof createDisplay>['display']) {
  return display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Filter by score')
}

test('the threshold drops arcs, and arcStyles stays undefined before the fetch', () => {
  const { display } = createDisplay()
  expect(display.arcStyles).toBeUndefined()

  display.setFeatures([feat('a', 1), feat('b', 5), feat('c', 10)])
  expect(display.arcStyles).toHaveLength(3)

  display.setMinScore(5)
  expect(display.arcStyles?.map(s => s.feature.id())).toEqual(['b', 'c'])
})

// the row is built off `scoreRange`, so it comes and goes with the data rather
// than sitting in the menu as a control that cannot filter anything
describe('the menu row', () => {
  it('is absent before any features arrive', () => {
    const { display } = createDisplay()
    expect(scoreFilterRow(display)).toBeUndefined()
  })

  it('is absent when the loaded features carry no score', () => {
    const { display } = createDisplay()
    display.setFeatures([feat('a'), feat('b')])
    expect(scoreFilterRow(display)).toBeUndefined()
  })

  it('appears once the scores span a range', () => {
    const { display } = createDisplay()
    display.setFeatures([feat('a', 1), feat('b', 10)])
    expect(scoreFilterRow(display)).toBeDefined()
    expect(display.scoreRange).toEqual({ min: 1, max: 10 })
  })
})
