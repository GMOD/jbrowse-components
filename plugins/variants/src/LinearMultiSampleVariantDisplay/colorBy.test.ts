import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

// Runtime "Color by...→Samples" wiring: setColorBy writes colorBy directly onto
// the display's config and recolors the sample rows (persisted as `layout`);
// colorByAttributes lists the samplesTsv metadata keys the user can group by.
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
    model.setColorBy('population')

    expect(model.colorBy).toBe('population')
    expect(readConfObject(model.configuration, 'colorBy')).toBe('population')
    // same population => same color, different => different
    const byName = Object.fromEntries(model.layout.map(s => [s.name, s.color]))
    expect(byName.HG001).toBe(byName.HG003)
    expect(byName.HG001).not.toBe(byName.HG002)
  })

  it('preserves an active groupBy ordering when recoloring', () => {
    const model = makeModel()
    model.setSources(sources)
    // group by population: EUR (2 members) sorts ahead of AFR (1)
    model.setGroupBy('population')
    expect(model.layout.map(s => s.name)).toEqual(['HG001', 'HG003', 'HG002'])

    // recoloring must keep the grouped order, not revert to adapter order
    model.setColorBy('sex')
    expect(model.layout.map(s => s.name)).toEqual(['HG001', 'HG003', 'HG002'])
  })

  it('clears the grouping when set to empty', () => {
    const model = makeModel()
    model.setSources(sources)
    model.setColorBy('population')
    model.setColorBy('')

    expect(model.colorBy).toBe('')
    expect(model.layout).toHaveLength(0)
  })
})
