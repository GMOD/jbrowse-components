import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

import type { FeatureHighlight } from './featureHighlight.ts'

const brca1: FeatureHighlight = {
  refName: 'ctgA',
  start: 1000,
  end: 2000,
  name: 'BRCA1',
}

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

type Display = ReturnType<
  ReturnType<typeof createTestEnvironment>['createDisplay']
>['display']

// Load one rendered feature into region 0's raw data (rpcDataMap), the input the
// pre-layout highlight resolver reads.
function loadFeature(
  display: Display,
  item: { featureId: string; startBp: number; endBp: number; name?: string },
) {
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [makeFlatbushItem(item)] }),
    10,
    ctgA,
  )
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

  it('resolves the highlight against raw data and pins it for layout', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    loadFeature(display, {
      featureId: 'feat-xyz',
      startBp: 1000,
      endBp: 2000,
      name: 'BRCA1',
    })

    // resolved pre-layout (from rpcDataMap) so it can feed the pin set
    expect([...display.highlightedFeatureIdSet]).toEqual(['feat-xyz'])
    // and the searched feature is pinned toward the top of the layout
    expect([...display.layoutPinnedFeatureIdSet]).toContain('feat-xyz')
  })

  it('a non-matching rendered feature is neither highlighted nor pinned', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    loadFeature(display, {
      featureId: 'other',
      startBp: 5000,
      endBp: 6000,
      name: 'TP53',
    })

    expect(display.highlightedFeatureIdSet.size).toBe(0)
    // falls back to the (empty) user pin set by reference
    expect(display.layoutPinnedFeatureIdSet).toBe(display.pinnedFeatureIdSet)
  })

  it('clearFeatureHighlights drops the pin so layout un-pins the feature', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })
    loadFeature(display, {
      featureId: 'feat-xyz',
      startBp: 1000,
      endBp: 2000,
      name: 'BRCA1',
    })
    expect([...display.layoutPinnedFeatureIdSet]).toContain('feat-xyz')

    display.clearFeatureHighlights()
    expect(display.highlightedFeatureIdSet.size).toBe(0)
    expect(display.layoutPinnedFeatureIdSet).toBe(display.pinnedFeatureIdSet)
  })

  it('merges the highlight with existing user pins', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [brca1],
      pinnedFeatureIds: ['pinned-1'],
    })

    loadFeature(display, {
      featureId: 'feat-xyz',
      startBp: 1000,
      endBp: 2000,
      name: 'BRCA1',
    })

    expect([...display.layoutPinnedFeatureIdSet].sort()).toEqual([
      'feat-xyz',
      'pinned-1',
    ])
  })
})
