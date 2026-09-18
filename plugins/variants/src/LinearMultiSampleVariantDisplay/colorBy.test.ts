import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

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
    const configSchema = configSchemaFactory()
    return stateModelFactory(configSchema).create({
      type: 'LinearMultiSampleVariantDisplay',
      configuration: configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'colorby-test',
      }),
    })
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
    model.setRowColor('population')

    expect(model.rowColor).toBe('population')
    expect(readConfObject(model.configuration, 'rowColor')).toBe('population')
    // same population => same color, different => different
    const byName = Object.fromEntries(
      model.sources.map(s => [s.name, s.labelColor]),
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
    model.setRowColor('sex')
    expect(model.sources.map(s => s.name)).toEqual(['HG002', 'HG001', 'HG003'])
  })

  // Set to empty, the tint goes and the banding stays: a recolor is not a
  // reorder in either direction.
  it('strips the palette when set to empty, keeping the order', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setFacet('population')
    model.setRowColor('population')
    model.setRowColor('')

    expect(model.rowColor).toBe('')
    expect(model.sources.map(s => s.name)).toEqual(['HG002', 'HG001', 'HG003'])
    expect(model.sources.some(s => s.labelColor)).toBe(false)
  })

  // While a channel is bound to a variable it beats a per-row constant — the
  // samplesTsv `color` column here, and equally a color the arrangement dialog
  // wrote or a palette an older session persisted into `layout`.
  it('wins over a samplesTsv color column, and hands it back when cleared', () => {
    const model = makeModel()
    model.setSources(sources.map(s => ({ ...s, color: 'rebeccapurple' })))
    model.setRowColor('population')
    expect(model.sources.some(s => s.labelColor === 'rebeccapurple')).toBe(
      false,
    )

    model.setRowColor('')
    expect(model.sources.every(s => s.labelColor === 'rebeccapurple')).toBe(
      true,
    )
  })

  it('writes no layout at all', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setRowColor('population')

    expect(model.layout).toHaveLength(0)
  })

  // The scale ranks values by how many rows carry them, so resolving it over
  // the drawn rows would recolor the cohort every time a clade was focused.
  it('keeps each row its color when a subtree filter hides the rest', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setRowColor('population')
    const before = new Map(model.sources.map(s => [s.name, s.labelColor]))

    model.setSubtreeFilter(['HG002'])

    expect(model.sources.map(s => s.name)).toEqual(['HG002'])
    expect(model.sources[0]!.labelColor).toBe(before.get('HG002'))
  })
})
