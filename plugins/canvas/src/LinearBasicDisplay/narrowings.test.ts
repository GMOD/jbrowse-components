import { activeCount, undoItems } from '@jbrowse/core/ui/filterMenuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'

describe('declared narrowings drive count and clear together', () => {
  it('clears everything it counts, and counts nothing afterwards', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    display.setJexlFilters([`jexl:get(feature,'score')>5`])
    display.toggleSoloFeature('gene1')
    display.applySolo()
    display.hideFeature('gene2')
    display.setShowOnlyGenes(true)

    const before = activeCount(display.featureNarrowings())
    expect(before).toBe(4)
    expect(display.featureFilterCount()).toBe(before)

    display.clearAllFeatureFilters()

    expect(activeCount(display.featureNarrowings())).toBe(0)
    expect(display.featureFilterCount()).toBe(0)
  })

  it('gives every active narrowing and mark a way back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.hideFeature('gene1')
    display.togglePinnedFeature('gene2')
    display.setFeatureHighlights([{ refName: 'ctgA', name: 'gene3' }])

    const all: Reversibles = {
      ...display.featureNarrowings(),
      ...display.featureMarks(),
    }
    for (const [key, entry] of Object.entries(all)) {
      if (entry.count > 0) {
        const reachable = !!entry.label || key in display.featureNarrowings()
        expect([key, reachable]).toEqual([key, true])
      }
    }
  })

  it('each undo row reverses exactly its own entry', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.hideFeature('gene1')
    display.togglePinnedFeature('gene2')

    const marks = display.featureMarks()
    const rows = undoItems(marks)
    expect(rows.map(r => ('label' in r ? r.label : undefined))).toEqual([
      'Unpin 1 feature',
    ])

    const row = rows[0]!
    if ('onClick' in row) {
      row.onClick()
    }
    expect(display.featureMarks().pinned!.count).toBe(0)
    expect(display.featureNarrowings().hiddenFeatures!.count).toBe(1)
  })
})
