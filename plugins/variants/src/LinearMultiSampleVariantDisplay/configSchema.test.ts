import PluginManager from '@jbrowse/core/PluginManager'
import { applyConfSettings, readConfObject } from '@jbrowse/core/configuration'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import CanvasPlugin from '@jbrowse/plugin-canvas'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import VariantsPlugin from '../index.ts'
import configSchemaFactory from './configSchema.ts'
import { createTestEnvironment } from './testEnv.ts'

describe('the display config schema', () => {
  const configSchema = configSchemaFactory()

  it("lifts v4's colorBy into the row color's attribute", () => {
    const config = configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'color-by',
      colorBy: 'population',
    })
    expect(readConfObject(config, ['rowColor', 'field'])).toBe('population')
  })

  // `showReferenceAlleles` was a second boolean whose only job was seeding this
  // one; it is gone, and this slot is the whole setting.
  describe('referenceDrawingMode config slot', () => {
    it("defaults to 'skip'", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-1',
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('skip')
    })

    it("can be set to 'draw'", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-2',
        referenceDrawingMode: 'draw',
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('draw')
    })

    it("lifts v4's showReferenceAlleles without a console line", () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-2b',
        showReferenceAlleles: true,
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('draw')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('axis', () => {
    const make = (snap: Record<string, unknown> = {}) =>
      configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-axis',
        ...snap,
      })

    it('draws the tree and labels and no grid by default', () => {
      const config = make()
      expect(readConfObject(config, ['axis', 'tree'])).toBe(true)
      expect(readConfObject(config, ['axis', 'labels'])).toBe(true)
      expect(readConfObject(config, ['axis', 'grid'])).toBe(false)
      expect(readConfObject(config, ['axis', 'width'])).toBe(80)
    })

    it.each([
      [{ showTree: false }, 'tree', false],
      [{ showSidebarLabels: false }, 'labels', false],
    ] as const)('lifts %j onto axis.%s', (snap, member, value) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      expect(readConfObject(make(snap), ['axis', member])).toBe(value)
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('unit config slot', () => {
    it('defaults to sample', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-7',
      })
      expect(readConfObject(config, 'unit')).toBe('sample')
    })

    it('can be set to haplotype', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-8',
        unit: 'haplotype',
      })
      expect(readConfObject(config, 'unit')).toBe('haplotype')
    })

    it.each([
      ['phased', 'haplotype'],
      ['alleleCount', 'sample'],
    ])(
      'the v4 renderingMode %s reaches the live display as unit %s',
      (old, unit) => {
        const { display } = createTestEnvironment({
          displayConfig: { renderingMode: old },
        }).createDisplay()
        expect(display.unit).toBe(unit)
      },
    )

    it('is part of the plot', () => {
      const { display } = createTestEnvironment().createDisplay()
      display.applyPlot({ unit: 'haplotype' })
      expect(display.plot.unit).toBe('haplotype')
    })

    it("a v4.3 session's renderingModeSetting lands in the unit slot", () => {
      const pluginManager = new PluginManager([
        new LinearGenomeViewPlugin(),
        new CanvasPlugin(),
        new VariantsPlugin(),
      ])
      pluginManager.createPluggableElements()
      pluginManager.configure()
      const display = pluginManager.getDisplayType(
        'LinearMultiSampleVariantDisplay',
      )
      expect(display.retiredState!.keys).toContain('renderingModeSetting')
      const lifted = display.retiredState!.lift({
        type: 'MultiLinearVariantDisplay',
        renderingModeSetting: 'phased',
      })
      const conf = display.configSchema.create(
        {
          type: 'LinearMultiSampleVariantDisplay',
          displayId: 'd',
          ...lifted,
        },
        { pluginManager },
      )
      expect(readConfObject(conf, 'unit')).toBe('haplotype')
    })
  })

  describe('filter', () => {
    const QUAL = { field: 'jexl:feature.QUAL > 30', equal: true }
    const MAF = { field: 'minorAlleleFrequency', gte: 0.05 }

    it('defaults to keeping every variant', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-default',
      })
      expect(predicatesOf(config.filter)).toEqual([])
    })

    it('holds the site fields beside the expressions', () => {
      const missing = { field: 'missingness', lte: 0.2 }
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-custom',
        filter: ['jexl:feature.QUAL > 30', MAF, missing],
      })
      expect(predicatesOf(config.filter)).toEqual([QUAL, MAF, missing])
    })

    it("lifts v4's minorAlleleFrequencyFilter and jexlFilters into it", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-v4',
        minorAlleleFrequencyFilter: 0.05,
        jexlFilters: ['feature.QUAL > 30'],
      })
      expect(predicatesOf(config.filter)).toEqual(
        expect.arrayContaining([QUAL, MAF]),
      )
      expect(predicatesOf(config.filter)).toHaveLength(2)
    })

    it("lifts v4's minorAlleleFrequencyFilter beside a filter list", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-v4-shorthand',
        filter: ['jexl:feature.QUAL > 30'],
        minorAlleleFrequencyFilter: 0.05,
      })
      expect(predicatesOf(config.filter)).toEqual([QUAL, MAF])
    })

    it("drops v4's minorAlleleFrequencyFilter at 0, which kept every variant", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-v4-zero',
        minorAlleleFrequencyFilter: 0,
      })
      expect(predicatesOf(config.filter)).toEqual([])
    })
  })
})

describe('rows', () => {
  const configSchema = configSchemaFactory()

  it('is the sample rows object, written whole', () => {
    const config = configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'test-rows-1',
      rows: { sort: ['b', 'a'], tree: '(b,a);', labels: { a: 'A' } },
    })
    expect(readConfObject(config, ['rows', 'field'])).toBe('sample')
    applyConfSettings(config, { rows: { sort: ['a', 'b'] } })
    expect(readConfObject(config, ['rows', 'sort'])).toEqual(['a', 'b'])
    expect(readConfObject(config, ['rows', 'tree'])).toBeUndefined()
    expect(readConfObject(config, ['rows', 'labels'])).toEqual({})
    expect(() =>
      configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-rows-2',
        rows: 'HP',
      }),
    ).toThrow(/SampleRowsField/)
  })
})

describe('rowColor config object', () => {
  const configSchema = configSchemaFactory()

  it('colors by the rows themselves by default', () => {
    const config = configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'test-colorby-1',
    })
    expect(readConfObject(config, ['rowColor', 'field'])).toBe('name')
  })

  it('can be set to a metadata attribute name', () => {
    const config = configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'test-colorby-2',
      rowColor: 'population',
    })
    expect(readConfObject(config, ['rowColor', 'field'])).toBe('population')
  })
})
