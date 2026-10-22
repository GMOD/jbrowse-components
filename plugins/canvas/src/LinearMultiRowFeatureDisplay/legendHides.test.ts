import { readConfObject, setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

function display() {
  const { display } = createTestEnvironment({
    displayConfig: {
      color: { field: 'state', domain: ['Enh', 'Tss'], range: ['red', 'blue'] },
    },
  }).createDisplay()
  display.setHiddenCategories(['Enh'])
  return display
}

// A hidden category is a name the key offered, so it outlives what leaves the
// key's names alone and clears with anything that renames them: a hide of
// `1` under one field would otherwise hide `1` under the next.
describe('the hidden categories follow the key that named them', () => {
  it('clear when Color by moves to another field', () => {
    const d = display()
    d.colorByField('strand')
    expect(d.hiddenCategories).toEqual([])
  })

  it('clear when Default or a solid color takes over from the field', () => {
    const toDefault = display()
    toDefault.pickDefaultColor()
    expect(toDefault.hiddenCategories).toEqual([])

    const toSolid = display()
    toSolid.setColorValue('#888')
    expect(toSolid.hiddenCategories).toEqual([])
  })

  it('stay through a palette edit and a repartition', () => {
    const d = display()
    setConf(d, 'color', {
      ...readConfObject(d.configuration, 'color'),
      range: ['green', 'blue'],
    })
    d.setRowsField('clade')
    expect(d.hiddenCategories).toEqual(['Enh'])
  })
})
