import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'

import type { FeatureHighlight } from './featureHighlight.ts'

const brca1: FeatureHighlight = {
  refName: 'ctgA',
  start: 1000,
  end: 2000,
  name: 'BRCA1',
}

describe('feature highlight declarative persistence', () => {
  it('setFeatureHighlights stores the request', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    display.setFeatureHighlights([brca1])
    expect(getSnapshot(display.featureHighlights)).toEqual([brca1])
  })

  it('a snapshot-seeded display hydrates with the highlight', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    expect(getSnapshot(display.featureHighlights)).toEqual([brca1])
  })

  it('setFeatureHighlights replaces rather than accumulates', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    const tp53: FeatureHighlight = {
      refName: 'ctgA',
      start: 5000,
      end: 6000,
      name: 'TP53',
    }
    display.setFeatureHighlights([tp53])
    expect(getSnapshot(display.featureHighlights)).toEqual([tp53])
  })

  it('clearFeatureHighlights empties the set', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    display.clearFeatureHighlights()
    expect(display.featureHighlights.length).toBe(0)
  })

  it('stripDefault omits featureHighlights from an at-default snapshot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const snap = getSnapshot(display)

    expect(snap).not.toHaveProperty('featureHighlights')
  })

  it('with no rendered features, nothing resolves as highlighted', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    // resolver runs against featureItemMap; empty until features render
    expect(display.highlightedFeatureIds).toEqual([])
  })
})
