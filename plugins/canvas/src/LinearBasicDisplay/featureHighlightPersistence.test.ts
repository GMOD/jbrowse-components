import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

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

// Load a gene whose span (0..3000) is the union of its transcripts, alongside a
// subfeature transcript spanning the searched region — the shape a text search
// for a transcript produces (its span never matches the gene's full span).
function loadGeneWithTranscript(display: Display) {
  display.setRpcData(
    0,
    makeFeatureData({
      flatbushItems: [
        makeFlatbushItem({ featureId: 'gene-1', startBp: 0, endBp: 3000 }),
      ],
      subfeatureInfos: [
        {
          kind: 'subfeature',
          featureId: 'transcript-1',
          type: 'mRNA',
          startBp: 1000,
          endBp: 2000,
          topPx: 0,
          bottomPx: 10,
          parentFeatureId: 'gene-1',
          displayLabel: 'BRCA1',
        },
      ],
    }),
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

    // resolver runs against the raw fetched data; empty until features load
    expect([...display.highlightedFeatureIdSet]).toEqual([])
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

  it('boxes a searched subfeature and pins its parent for layout', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    loadGeneWithTranscript(display)

    // the gene's full span (0..3000) does not match; the transcript subfeature
    // (1000..2000) does, so the subfeature is boxed...
    expect([...display.highlightedFeatureIdSet]).toEqual(['transcript-1'])
    // ...while its PARENT gene is what gets pinned to the top of the layout
    expect([...display.layoutPinnedFeatureIdSet]).toEqual(['gene-1'])
  })

  it('boxes only the matched gene, not its subfeatures, on a gene search', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    // gene span (1000..2000) matches the highlight exactly, and its transcript
    // subfeatures share the gene's indexed name and overlap its span
    display.setRpcData(
      0,
      makeFeatureData({
        flatbushItems: [
          makeFlatbushItem({
            featureId: 'gene-1',
            startBp: 1000,
            endBp: 2000,
            name: 'BRCA1',
          }),
        ],
        subfeatureInfos: [
          {
            kind: 'subfeature',
            featureId: 'transcript-1',
            type: 'mRNA',
            startBp: 1000,
            endBp: 2000,
            topPx: 0,
            bottomPx: 10,
            parentFeatureId: 'gene-1',
            displayLabel: 'BRCA1',
          },
        ],
      }),
      10,
      ctgA,
    )

    // one clean box around the gene, no redundant sub-boxes inside the glyph
    expect([...display.highlightedFeatureIdSet]).toEqual(['gene-1'])
  })

  it('addFeatureHighlightForItem accumulates rather than replacing', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    display.addFeatureHighlightForItem(
      { startBp: 5000, endBp: 6000, name: 'TP53' },
      'ctgA',
    )
    expect(getSnapshot(display.featureHighlights)).toEqual([
      brca1,
      { refName: 'ctgA', start: 5000, end: 6000, name: 'TP53' },
    ])
  })

  it('addFeatureHighlightForItem is idempotent for an already-highlighted feature', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })

    display.addFeatureHighlightForItem(
      { startBp: 1000, endBp: 2000, name: 'BRCA1' },
      'ctgA',
    )
    expect(getSnapshot(display.featureHighlights)).toEqual([brca1])
  })

  it('removeFeatureHighlightsForId drops an exact manual highlight', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })
    loadFeature(display, {
      featureId: 'feat-1',
      startBp: 1000,
      endBp: 2000,
      name: 'BRCA1',
    })

    display.removeFeatureHighlightsForId('feat-1')
    expect(display.featureHighlights.length).toBe(0)
  })

  it('removeFeatureHighlightsForId clears a search-drifted highlight by span', () => {
    const { createDisplay } = createTestEnvironment()
    // a search highlight whose stored name is trix's indexed description, not
    // the rendered feature's Name — it still resolves to the feature by span, so
    // removing that feature's box must still clear it
    const searchDrift: FeatureHighlight = {
      refName: 'ctgA',
      start: 1000,
      end: 2000,
      name: 'protein kinase',
    }
    const { display } = createDisplay({ featureHighlights: [searchDrift] })
    loadFeature(display, {
      featureId: 'feat-1',
      startBp: 1000,
      endBp: 2000,
      name: 'BRCA1',
    })

    display.removeFeatureHighlightsForId('feat-1')
    expect(display.featureHighlights.length).toBe(0)
  })

  it('removeFeatureHighlightsForId leaves a highlight that boxes something else', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ featureHighlights: [brca1] })
    loadFeature(display, {
      featureId: 'feat-1',
      startBp: 1000,
      endBp: 2000,
      name: 'BRCA1',
    })

    display.removeFeatureHighlightsForId('unrelated-feat')
    expect(getSnapshot(display.featureHighlights)).toEqual([brca1])
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
