import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { applySnapshot, getSnapshot } from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

function display() {
  const { display } = createTestEnvironment({
    displayConfig: {
      encoding: {
        color: {
          field: 'state',
          scale: { domain: ['Enh', 'Tss'], range: ['red', 'blue'] },
        },
      },
    },
  }).createDisplay()
  display.setHiddenCategories(['Enh'])
  return display
}

// A hidden category is a name the key offered, so it outlives what leaves the
// key's names alone and lapses with anything that renames them: a hide of
// `1` under one field would otherwise hide `1` under the next.
describe('the hidden categories follow the key that named them', () => {
  it('lapse when Color by moves to another field', () => {
    const d = display()
    d.colorByField('strand')
    expect(d.activeHiddenCategories).toEqual([])
  })

  it('lapse when Default or a solid color takes over from the field', () => {
    const toDefault = display()
    toDefault.pickDefaultColor()
    expect(toDefault.activeHiddenCategories).toEqual([])

    const toSolid = display()
    toSolid.setColorValue('#888')
    expect(toSolid.activeHiddenCategories).toEqual([])
  })

  it('stay through a palette edit, a kept fallback color, the scale it already had, and a repartition', () => {
    const d = display()
    const color = readConfObject(d.configuration, ['encoding', 'color'])
    setConf(d, ['encoding', 'color'], {
      ...color,
      value: '#888',
      scale: { ...color.scale, range: ['green', 'blue'], type: 'ordinal' },
    })
    d.setRowsField('clade')
    expect(d.activeHiddenCategories).toEqual(['Enh'])
  })

  it('come back with an undo that restores the key and the display together', () => {
    const d = display()
    const before = getSnapshot(d)
    const color = readConfObject(d.configuration, ['encoding', 'color'])
    d.colorByField('strand')
    expect(d.activeHiddenCategories).toEqual([])
    runInAction(() => {
      setConf(d, ['encoding', 'color'], color)
      applySnapshot(d, before)
    })
    expect(d.activeHiddenCategories).toEqual(['Enh'])
  })

  it('stay lapsed when an undo restores the display but not the key', () => {
    const d = display()
    const before = getSnapshot(d)
    d.colorByField('strand')
    applySnapshot(d, before)
    expect(d.hiddenCategories).toEqual(['Enh'])
    expect(d.activeHiddenCategories).toEqual([])
  })

  it('a hide picked under the new key starts from none', () => {
    const d = display()
    d.colorByField('strand')
    d.toggleCategory(['+'])
    expect(d.activeHiddenCategories).toEqual(['+'])
  })
})
