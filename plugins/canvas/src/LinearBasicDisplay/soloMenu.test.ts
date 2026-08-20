import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  contextMenuLabels,
  createTestEnvironment,
  rightClick,
} from './testEnv.ts'

import type { TestDisplay } from './testEnv.ts'

// The show-only ("solo") rows of the feature right-click menu, across the three
// states the list can be in: empty, collected-but-unapplied, and applied.

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const genes = ['a', 'b', 'c'].map((id, i) =>
  makeFlatbushItem({
    featureId: id,
    type: 'gene',
    name: id.toUpperCase(),
    startBp: 1000 + i * 1000,
    endBp: 1500 + i * 1000,
  }),
)
const [geneA, geneB] = genes

function load(display: TestDisplay) {
  display.setRpcData(0, makeFeatureData({ flatbushItems: genes }), ctgA)
  display.setLoadedRegion(0, ctgA)
}

// The one-shot isolate row's label, which is where the "replaces the N
// selected" note lives when there is a collection to lose (`withHint`), so the
// row is found by its base label rather than an exact match.
function soloLabel(display: TestDisplay) {
  return contextMenuLabels(display).find(l =>
    String(l).startsWith('Show only this feature'),
  )
}

// Only the show-only rows, in menu order — the rest of the menu is other tests'.
function soloLabels(display: TestDisplay) {
  return contextMenuLabels(display).filter(
    l =>
      String(l).includes('show-only list') ||
      String(l).startsWith('Show only this') ||
      String(l).startsWith('Show all'),
  )
}

describe('show-only list context menu', () => {
  it('offers the one-shot isolate and a collect row on an empty list', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    load(display)

    rightClick(display, geneA!)

    expect(soloLabels(display)).toEqual([
      'Show only this feature',
      'Add to show-only list',
    ])
  })

  it('offers to drop a feature already collected, without applying', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ soloFeatureIds: ['a', 'b'] })
    load(display)

    rightClick(display, geneA!)

    expect(soloLabels(display)).toEqual([
      // two are collected and none applied, so the isolate row says what it
      // would discard
      'Show only this feature — replaces the 2 selected',
      'Remove from show-only list',
    ])
    // collecting hides nothing until applied, so there is nothing to undo yet —
    // the chip's × is the recovery for an unapplied list
    expect(display.soloApplied).toBe(false)
  })

  // The gap this covers: an applied list of several could only be widened back
  // to everything and re-collected, because the row that narrows it was offered
  // in the unapplied state alone.
  it('narrows an applied list of several down to the clicked feature', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      soloFeatureIds: ['a', 'b', 'c'],
      soloApplied: true,
    })
    load(display)

    rightClick(display, geneB!)
    expect(soloLabels(display)).toEqual([
      'Show only this feature',
      'Remove from show-only list',
      'Show all features again',
    ])

    clickContextMenuItem(display, 'Show only this feature')

    expect([...display.soloFeatureIds]).toEqual(['b'])
    expect(display.soloApplied).toBe(true)
  })

  // Same first row in both states, so a click where "show only this" was cannot
  // land on "show everything again" once the list is applied.
  it('leads with the same row applied or not', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      soloFeatureIds: ['a', 'b'],
      soloApplied: true,
    })
    load(display)

    rightClick(display, geneA!)

    expect(soloLabels(display)[0]).toBe('Show only this feature')
  })

  // `soloFeature` replaces the list, and the collection it discards is visible
  // only as a corner count — so the row that discards it says so.
  it('warns that the one-shot isolate discards a collection', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ soloFeatureIds: ['a', 'b', 'c'] })
    load(display)

    rightClick(display, geneA!)
    expect(soloLabel(display)).toBe(
      'Show only this feature — replaces the 3 selected',
    )
  })

  it('says nothing about replacing when there is nothing to lose', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ soloFeatureIds: ['a'] })
    load(display)

    rightClick(display, geneA!)
    expect(soloLabel(display)).toBe('Show only this feature')

    // nor once applied, where the list IS what is shown and narrowing it is the
    // row's advertised job rather than a loss
    const applied = createDisplay({
      soloFeatureIds: ['a', 'b', 'c'],
      soloApplied: true,
    }).display
    load(applied)

    rightClick(applied, geneA!)
    expect(soloLabel(applied)).toBe('Show only this feature')
  })

  it('offers only the undo once the list holds this feature alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      soloFeatureIds: ['a'],
      soloApplied: true,
    })
    load(display)

    rightClick(display, geneA!)

    // narrowing to the only member changes nothing, and dropping it empties the
    // list — which un-applies. Both are "Show all features again" by another
    // name, so neither is offered.
    expect(soloLabels(display)).toEqual(['Show all features again'])

    clickContextMenuItem(display, 'Show all features again')
    expect([...display.soloFeatureIds]).toEqual([])
    expect(display.soloApplied).toBe(false)
  })
})
