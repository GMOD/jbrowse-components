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
}

function soloLabel(display: TestDisplay) {
  return contextMenuLabels(display).find(l =>
    String(l).startsWith('Show only this feature'),
  )
}

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
      'Show only this feature — replaces the 2 selected',
      'Remove from show-only list',
    ])
    expect(display.soloApplied).toBe(false)
  })

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

    expect(soloLabels(display)).toEqual(['Show all features again'])

    clickContextMenuItem(display, 'Show all features again')
    expect([...display.soloFeatureIds]).toEqual([])
    expect(display.soloApplied).toBe(false)
  })
})
