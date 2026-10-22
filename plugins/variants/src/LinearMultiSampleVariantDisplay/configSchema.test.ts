import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
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
