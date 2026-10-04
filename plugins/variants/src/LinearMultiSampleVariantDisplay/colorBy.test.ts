import { readConfObject } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

// Runtime "Color by...→Samples" wiring: setColorBy writes colorBy onto the
// display's config and nothing else — the tint resolves on every read of
// `sources`. colorByAttributes lists the samplesTsv metadata keys the user can
// band by.
describe('multi-sample variant colorBy', () => {
  const sources = [
    { name: 'HG001', population: 'EUR', sex: 'M' },
    { name: 'HG002', population: 'AFR', sex: 'F' },
    { name: 'HG003', population: 'EUR', sex: 'M' },
  ]
  function makeModel() {
    return createTestEnvironment().createDisplay().display
  }

  it('lists metadata attributes excluding internal plumbing', () => {
    const model = makeModel()
    model.setSources(sources)
    expect(new Set(model.colorByAttributes)).toEqual(
      new Set(['population', 'sex']),
    )
  })

  it('colors rows by attribute and writes it onto the config', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setRowColorField('population')

    expect(model.rowColorAttribute).toBe('population')
    expect(readConfObject(model.configuration, ['rowColor', 'field'])).toBe(
      'population',
    )
    // same population => same color, different => different
    const byName = Object.fromEntries(
      model.sources.map(s => [s.name, s.rowColor]),
    )
    expect(byName.HG001).toBe(byName.HG003)
    expect(byName.HG001).not.toBe(byName.HG002)
  })

  it('preserves an active facet ordering when recoloring', () => {
    const model = makeModel()
    model.setSources(sources)
    // band by population: with no domain the bands sort, AFR ahead of EUR
    model.setFacet('population')
    expect(model.sources.map(s => s.name)).toEqual(['HG002', 'HG001', 'HG003'])

    // both channels resolve on the same read, so one cannot displace the other
    model.setRowColorField('sex')
    expect(model.sources.map(s => s.name)).toEqual(['HG002', 'HG001', 'HG003'])
  })

  // Set to empty, the tint goes and the banding stays: a recolor is not a
  // reorder in either direction.
  it('strips the palette when set to empty, keeping the order', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setFacet('population')
    model.setRowColorField('population')
    model.setRowColorField('')

    expect(model.rowColorAttribute).toBe('')
    expect(model.sources.map(s => s.name)).toEqual(['HG002', 'HG001', 'HG003'])
    expect(model.sources.some(s => s.rowColor)).toBe(false)
  })

  // While a channel is bound to a variable it beats a per-row constant — the
  // samplesTsv `color` column here, and equally a colour the arrangement
  // dialog wrote into `rowColor`.
  it('wins over a samplesTsv color column, and hands it back when cleared', () => {
    const model = makeModel()
    model.setSources(sources.map(s => ({ ...s, color: 'rebeccapurple' })))
    model.setRowColorField('population')
    expect(model.sources.some(s => s.rowColor === 'rebeccapurple')).toBe(false)

    model.setRowColorField('')
    expect(model.sources.every(s => s.rowColor === 'rebeccapurple')).toBe(true)
  })

  it('writes no arrangement at all', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setRowColorField('population')

    expect(model.rowDomain).toEqual([])
    expect(model.rowArrangementIsCustom).toBe(false)
  })

  // The scale ranks values by how many rows carry them, so resolving it over
  // the drawn rows would recolor the cohort every time a clade was focused.
  it('keeps each row its color when a subtree filter hides the rest', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setRowColorField('population')
    const before = new Map(model.sources.map(s => [s.name, s.rowColor]))

    model.setRowFocus(['HG002'])

    expect(model.sources.map(s => s.name)).toEqual(['HG002'])
    expect(model.sources[0]!.rowColor).toBe(before.get('HG002'))
  })

  // No palette deals the rows by name here, so None is the one choice over
  // `name`, and it shows the tints set row by row.
  it('reads the tints set row by row as None, and returns to them', () => {
    const model = makeModel()
    model.setSources(sources)
    expect(model.rowPaletteDeals).toBe(false)
    const [first, ...rest] = model.editableSources
    model.applyRowEdits([{ ...first!, rowColor: '#123456' }, ...rest])
    expect(model.rowColorChoice).toBe('')
    expect(model.sources[0]!.rowColor).toBe('#123456')
    expect(model.sources[1]!.rowColor).toBeUndefined()

    model.setRowColorField('population')
    expect(model.rowColorChoice).toBe('population')
    model.setRowColorField('')
    expect(model.rowColorChoice).toBe('')
    expect(model.sources[1]!.rowColor).toBeUndefined()
  })
})

// The dialog shows a configured attribute the samples lack as chosen, so the
// menu does too, rather than ticking nothing.
test('the Samples menu ticks a configured attribute the samples lack', () => {
  const { display } = createTestEnvironment({
    displayConfig: { rowColor: 'tissue' },
  }).createDisplay()
  display.setSources([{ name: 'HG001', population: 'EUR' }])
  const colorBy = display
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'Color by...')
  const items = colorBy && 'subMenu' in colorBy ? resolveSubMenu(colorBy) : []
  const tissue = items.find(i => 'label' in i && i.label === 'Tissue')
  expect(tissue && 'checked' in tissue && tissue.checked).toBe(true)
})
