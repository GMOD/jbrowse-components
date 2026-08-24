import { SimpleFeature } from '@jbrowse/core/util'

import { createPairedTestEnvironment } from '../shared/testEnv.ts'

import type { Feature } from '@jbrowse/core/util'

const { createDisplay } = createPairedTestEnvironment({ color: 'red' })

// each feature gets its own coordinates: arcStyles dedupes on the endpoint
// pair, so features sharing one collapse to a single arc
function feat(uniqueId: string, start: number, score?: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgA',
    start,
    end: start + 100,
    ALT: [`N[ctgA:${start + 5000}[`],
    ...(score === undefined ? {} : { score }),
  })
}

function scoreFilterRow(display: ReturnType<typeof createDisplay>['display']) {
  return display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Filter by score')
}

test('the threshold drops arcs', () => {
  const { display } = createDisplay()
  display.setFeatures([
    feat('a', 1000, 1),
    feat('b', 2000, 5),
    feat('c', 3000, 10),
  ])
  expect(display.arcStyles).toHaveLength(3)

  display.setMinScore(5)
  expect(display.arcStyles?.map(s => s.feature.id())).toEqual(['b', 'c'])
})

describe('the menu row', () => {
  it('is absent when the loaded features carry no score', () => {
    const { display } = createDisplay()
    display.setFeatures([feat('a', 1000), feat('b', 2000)])
    expect(scoreFilterRow(display)).toBeUndefined()
  })

  it('appears once the scores span a range', () => {
    const { display } = createDisplay()
    display.setFeatures([feat('a', 1000, 1), feat('b', 2000, 10)])
    expect(scoreFilterRow(display)).toBeDefined()
    expect(display.scoreRange).toEqual({ min: 1, max: 10 })
  })
})
