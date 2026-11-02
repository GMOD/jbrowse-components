import PluginManager from '@jbrowse/core/PluginManager'
import {
  applyConfSettings,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import FeaturesPlugin from '@jbrowse/plugin-features'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import VariantsPlugin from '../index.ts'
import configSchemaFactory from './configSchema.ts'
import { createTestEnvironment } from './testEnv.ts'

describe('the display config schema', () => {
  const configSchema = configSchemaFactory()

  it("lifts v4's colorBy into the row color's attribute", () => {
    const config = configSchema.create({
      type: 'LinearVariantDisplay',
      displayId: 'color-by',
      colorBy: 'population',
    })
    expect(readConfObject(config, ['rows', 'color', 'field'])).toBe(
      'population',
    )
  })

  describe('genotypes.reference.show', () => {
    it('defaults to off', () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-1',
      })
      expect(readConfObject(config, ['genotypes', 'reference', 'show'])).toBe(
        false,
      )
    })

    it('can be turned on', () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-2',
        genotypes: { reference: { show: true } },
      })
      expect(readConfObject(config, ['genotypes', 'reference', 'show'])).toBe(
        true,
      )
    })

    it("lifts v4's showReferenceAlleles without a console line", () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-2b',
        showReferenceAlleles: true,
      })
      expect(readConfObject(config, ['genotypes', 'reference', 'show'])).toBe(
        true,
      )
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it.each([
      ['draw', true],
      ['skip', false],
    ])(
      "lifts v4's referenceDrawingMode %s without a console line",
      (mode, show) => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const config = configSchema.create({
          type: 'LinearVariantDisplay',
          displayId: 'test-2c',
          referenceDrawingMode: mode,
        })
        expect(readConfObject(config, ['genotypes', 'reference', 'show'])).toBe(
          show,
        )
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
      },
    )

    it('a lifted referenceDrawingMode keeps a written genotypes.show', () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-2d',
        referenceDrawingMode: 'draw',
        genotypes: { show: false },
      })
      expect(readConfObject(config, ['genotypes', 'show'])).toBe(false)
      expect(readConfObject(config, ['genotypes', 'reference', 'show'])).toBe(
        true,
      )
    })
  })

  describe('axis', () => {
    const make = (snap: Record<string, unknown> = {}) =>
      configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-axis',
        ...snap,
      })

    it('draws the tree and labels and no grid by default', () => {
      const config = make()
      expect(readConfObject(config, ['rows', 'axis', 'tree'])).toBe(true)
      expect(readConfObject(config, ['rows', 'axis', 'labels'])).toBe(true)
      expect(readConfObject(config, ['rows', 'axis', 'grid'])).toBe(false)
      expect(readConfObject(config, ['rows', 'axis', 'width'])).toBe(80)
    })

    it.each([
      [{ showTree: false }, 'tree', false],
      [{ showSidebarLabels: false }, 'labels', false],
    ] as const)('lifts %j onto rows.axis.%s', (snap, member, value) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      expect(readConfObject(make(snap), ['rows', 'axis', member])).toBe(value)
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('rows.field', () => {
    it('defaults to sample', () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-7',
      })
      expect(readConfObject(config, ['rows', 'field'])).toBe('sample')
    })

    it.each([
      ['an object', { field: 'haplotype' }],
      ['its shorthand', 'haplotype'],
    ])('can be set to haplotype by %s', (_, rows) => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-8',
        rows,
      })
      expect(readConfObject(config, ['rows', 'field'])).toBe('haplotype')
    })

    it('a beta unit points at rows.field, on load and on a write', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-unit',
        unit: 'haplotype',
      })
      const warnings = warn.mock.calls.map(([message]) => message)
      warn.mockRestore()
      expect(readConfObject(config, ['rows', 'field'])).toBe('sample')
      expect(warnings).toEqual([
        expect.stringMatching(
          /does not declare unit.*did you mean rows\.field\?$/,
        ),
      ])
      expect(() => {
        // @ts-expect-error a misnamed word is no slot
        setConf(config, 'unit', 'haplotype')
      }).toThrow(/did you mean rows\.field\?$/)
    })

    it.each([
      ['phased', 'haplotype'],
      ['alleleCount', 'sample'],
    ])(
      'the v4 renderingMode %s reaches the live display as rows.field %s',
      (old, rowsField) => {
        const { display } = createTestEnvironment({
          displayConfig: { renderingMode: old },
        }).createDisplay()
        expect(display.rowsField).toBe(rowsField)
      },
    )

    it('the v4 renderingMode lands beside an arrangement the config states', () => {
      const { display } = createTestEnvironment({
        displayConfig: { renderingMode: 'phased', rows: { sort: ['b'] } },
      }).createDisplay()
      expect(display.rowsField).toBe('haplotype')
      expect(display.rowSort).toEqual(['b'])
    })

    it('is part of the plot', () => {
      const { display } = createTestEnvironment().createDisplay()
      display.applyPlot({ rows: { field: 'haplotype' } })
      expect(display.plot.rows).toMatchObject({ field: 'haplotype' })
    })

    it("a v4.3 session's renderingModeSetting lands in rows.field", () => {
      const pluginManager = new PluginManager([
        new LinearGenomeViewPlugin(),
        new FeaturesPlugin(),
        new VariantsPlugin(),
      ])
      pluginManager.createPluggableElements()
      pluginManager.configure()
      const display = pluginManager.getDisplayType('LinearVariantDisplay')
      expect(display.retiredState!.keys).toContain('renderingModeSetting')
      const lifted = display.retiredState!.lift({
        type: 'MultiLinearVariantDisplay',
        renderingModeSetting: 'phased',
      })
      const conf = display.configSchema.create(
        {
          type: 'LinearVariantDisplay',
          displayId: 'd',
          ...lifted,
        },
        { pluginManager },
      )
      expect(readConfObject(conf, ['rows', 'field'])).toBe('haplotype')
    })

    // v4.3 named a phased row from HP0, and its layout rows carry the sample
    // and the index
    it("a v4.3 phased session's rows, tree and focus name the haplotypes from HP1", () => {
      const pluginManager = new PluginManager([
        new LinearGenomeViewPlugin(),
        new FeaturesPlugin(),
        new VariantsPlugin(),
      ])
      pluginManager.createPluggableElements()
      pluginManager.configure()
      const display = pluginManager.getDisplayType('LinearVariantDisplay')
      const v4Row = (baseName: string, HP: number, label?: string) => ({
        name: `${baseName} HP${HP}`,
        baseName,
        HP,
        ...(label ? { label } : {}),
      })
      const lifted = display.retiredState!.lift({
        type: 'MultiLinearVariantDisplay',
        renderingModeSetting: 'phased',
        layout: [
          v4Row('B', 1),
          v4Row('A', 0, 'Mother hap1'),
          v4Row('B', 0, 'B HP0'),
          v4Row('A', 1),
        ],
        clusterTree:
          "((('B HP1':0.1,'A HP0':0.1):0.2,'B HP0':0.3):0.1,'A HP1':0.4);",
        subtreeFilter: ['B HP1', 'A HP0'],
      })
      const conf = display.configSchema.create(
        { type: 'LinearVariantDisplay', displayId: 'd', ...lifted },
        { pluginManager },
      )
      expect(readConfObject(conf, ['rows', 'sort'])).toEqual([
        'B HP2',
        'A HP1',
        'B HP1',
        'A HP2',
      ])
      expect(readConfObject(conf, ['rows', 'labels'])).toEqual({
        'A HP1': 'Mother hap1',
      })
      expect(readConfObject(conf, ['rows', 'kept'])).toEqual(['B HP2', 'A HP1'])
      expect(readConfObject(conf, ['rows', 'tree', 'newick'])).toBe(
        '(((B HP2:0.1,A HP1:0.1):0.2,B HP1:0.3):0.1,A HP2:0.4);',
      )
    })

    it("a v4.3 session's menu settings land in their slots", () => {
      const pluginManager = new PluginManager([
        new LinearGenomeViewPlugin(),
        new FeaturesPlugin(),
        new VariantsPlugin(),
      ])
      pluginManager.createPluggableElements()
      pluginManager.configure()
      const display = pluginManager.getDisplayType('LinearVariantDisplay')
      const conf = display.configSchema.create(
        {
          type: 'LinearVariantDisplay',
          displayId: 'd',
          ...display.retiredState!.lift({
            type: 'MultiLinearVariantDisplay',
            minorAlleleFrequencyFilterSetting: 0.1,
            referenceDrawingModeSetting: 'draw',
            rowHeightMode: 12,
            showTreeSetting: false,
          }),
        },
        { pluginManager },
      )
      expect(predicatesOf(conf.filter)).toEqual([
        { field: 'minorAlleleFrequency', gte: 0.1 },
      ])
      expect(readConfObject(conf, ['genotypes', 'reference', 'show'])).toBe(
        true,
      )
      expect(readConfObject(conf, ['rows', 'step'])).toBe(12)
      expect(readConfObject(conf, ['rows', 'axis', 'tree'])).toBe(false)
    })
  })

  describe('filter', () => {
    const QUAL = { field: 'jexl:feature.QUAL > 30', equal: true }
    const MAF = { field: 'minorAlleleFrequency', gte: 0.05 }

    it('defaults to keeping every variant', () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-filter-default',
      })
      expect(predicatesOf(config.filter)).toEqual([])
    })

    it('holds the site fields beside the expressions', () => {
      const missing = { field: 'missingness', lte: 0.2 }
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-filter-custom',
        filter: ['jexl:feature.QUAL > 30', MAF, missing],
      })
      expect(predicatesOf(config.filter)).toEqual([QUAL, MAF, missing])
    })

    it("lifts v4's minorAlleleFrequencyFilter and jexlFilters into it", () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
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
        type: 'LinearVariantDisplay',
        displayId: 'test-filter-v4-shorthand',
        filter: ['jexl:feature.QUAL > 30'],
        minorAlleleFrequencyFilter: 0.05,
      })
      expect(predicatesOf(config.filter)).toEqual([QUAL, MAF])
    })

    it("drops v4's minorAlleleFrequencyFilter at 0, which kept every variant", () => {
      const config = configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-filter-v4-zero',
        minorAlleleFrequencyFilter: 0,
      })
      expect(predicatesOf(config.filter)).toEqual([])
    })
  })
})

describe('rows', () => {
  const configSchema = configSchemaFactory()

  it('is the variant rows object, written member by member', () => {
    const config = configSchema.create({
      type: 'LinearVariantDisplay',
      displayId: 'test-rows-1',
      rows: { sort: ['b', 'a'], tree: '(b,a);', labels: { a: 'A' } },
    })
    expect(readConfObject(config, ['rows', 'field'])).toBe('sample')
    applyConfSettings(config, { rows: { sort: ['a', 'b'] } })
    expect(readConfObject(config, ['rows', 'sort'])).toEqual(['a', 'b'])
    expect(readConfObject(config, ['rows', 'tree', 'newick'])).toBe('(b,a);')
    expect(readConfObject(config, ['rows', 'labels'])).toEqual({ a: 'A' })
    expect(() =>
      configSchema.create({
        type: 'LinearVariantDisplay',
        displayId: 'test-rows-2',
        rows: 'HP',
      }),
    ).toThrow(/VariantRowsField/)
  })
})

describe('rows.color config object', () => {
  const configSchema = configSchemaFactory()

  it('colors by the rows themselves by default', () => {
    const config = configSchema.create({
      type: 'LinearVariantDisplay',
      displayId: 'test-colorby-1',
    })
    expect(readConfObject(config, ['rows', 'color', 'field'])).toBe('name')
  })

  it('can be set to a metadata attribute name', () => {
    const config = configSchema.create({
      type: 'LinearVariantDisplay',
      displayId: 'test-colorby-2',
      rows: { color: 'population' },
    })
    expect(readConfObject(config, ['rows', 'color', 'field'])).toBe(
      'population',
    )
  })
})
