import PluginManager from '@jbrowse/core/PluginManager'
import {
  applyConfSettings,
  plotWrites,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import CanvasPlugin from '@jbrowse/plugin-canvas'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import VariantsPlugin from '../index.ts'
import configSchemaFactory from './configSchema.ts'
import { createTestEnvironment } from './testEnv.ts'

describe('the display config schema', () => {
  const configSchema = configSchemaFactory()

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

  describe('showRowLabels config slot', () => {
    it('has default value of true', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-3',
      })
      expect(readConfObject(config, 'showRowLabels')).toBe(true)
    })

    it('can be set to false', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-4',
        showRowLabels: false,
      })
      expect(readConfObject(config, 'showRowLabels')).toBe(false)
    })
  })

  describe('showTree config slot', () => {
    it('has default value of true', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-5',
      })
      expect(readConfObject(config, 'showTree')).toBe(true)
    })

    it('can be set to false', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-6',
        showTree: false,
      })
      expect(readConfObject(config, 'showTree')).toBe(false)
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
    it('defaults to keeping every variant', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-default',
      })
      expect(
        readConfObject(config, ['filter', 'minMinorAlleleFrequency']),
      ).toBe(0)
      expect(readConfObject(config, ['filter', 'maxMissingness'])).toBe(1)
      expect(readConfObject(config, ['filter', 'expressions'])).toEqual([])
    })

    it('holds the thresholds beside the expressions', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-custom',
        filter: {
          expressions: ['jexl:feature.QUAL > 30'],
          minMinorAlleleFrequency: 0.05,
          maxMissingness: 0.2,
        },
      })
      expect(
        readConfObject(config, ['filter', 'minMinorAlleleFrequency']),
      ).toBe(0.05)
      expect(readConfObject(config, ['filter', 'maxMissingness'])).toBe(0.2)
      expect(readConfObject(config, ['filter', 'expressions'])).toEqual([
        'jexl:feature.QUAL > 30',
      ])
    })

    it("lifts v4's minorAlleleFrequencyFilter and jexlFilters into it", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-v4',
        minorAlleleFrequencyFilter: 0.05,
        jexlFilters: ['feature.QUAL > 30'],
      })
      expect(
        readConfObject(config, ['filter', 'minMinorAlleleFrequency']),
      ).toBe(0.05)
      expect(readConfObject(config, ['filter', 'expressions'])).toEqual([
        'jexl:feature.QUAL > 30',
      ])
    })

    it("lifts v4's minorAlleleFrequencyFilter beside a filter list", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-v4-shorthand',
        filter: ['jexl:feature.QUAL > 30'],
        minorAlleleFrequencyFilter: 0.05,
      })
      expect(
        readConfObject(config, ['filter', 'minMinorAlleleFrequency']),
      ).toBe(0.05)
      expect(readConfObject(config, ['filter', 'expressions'])).toEqual([
        'jexl:feature.QUAL > 30',
      ])
    })

    it("a plot's filter list keeps the thresholds", () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-plot',
        filter: { minMinorAlleleFrequency: 0.05, maxMissingness: 0.2 },
      })
      for (const [key, value] of Object.entries(
        plotWrites(config, { filter: ['jexl:feature.QUAL > 30'] }),
      )) {
        setConf(config, key as 'filter', value)
      }
      expect(readConfObject(config, ['filter', 'expressions'])).toEqual([
        'jexl:feature.QUAL > 30',
      ])
      expect(
        readConfObject(config, ['filter', 'minMinorAlleleFrequency']),
      ).toBe(0.05)
      expect(readConfObject(config, ['filter', 'maxMissingness'])).toBe(0.2)
    })

    it('takes a list as its expressions, and a bag merges its members', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-filter-shorthand',
        filter: ['jexl:feature.QUAL > 30'],
      })
      applyConfSettings(config, { filter: { maxMissingness: 0.1 } })
      expect(readConfObject(config, ['filter', 'expressions'])).toEqual([
        'jexl:feature.QUAL > 30',
      ])
      expect(readConfObject(config, ['filter', 'maxMissingness'])).toBe(0.1)
    })
  })
})

describe('rows', () => {
  const configSchema = configSchemaFactory()

  it('is the sample rows object, written whole', () => {
    const config = configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'test-rows-1',
      rows: { domain: ['b', 'a'], tree: '(b,a);', labels: { a: 'A' } },
    })
    expect(readConfObject(config, ['rows', 'field'])).toBe('sample')
    applyConfSettings(config, { rows: { domain: ['a', 'b'] } })
    expect(readConfObject(config, ['rows', 'domain'])).toEqual(['a', 'b'])
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
