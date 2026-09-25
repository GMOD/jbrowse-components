import { readConfObject } from '@jbrowse/core/configuration'
import { rowColorScale } from '@jbrowse/tree-sidebar'

import configSchemaFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import {
  applyAttributeColors,
  attributeColorDeal,
} from './MultiSampleVariantBaseModel.ts'

import type { Source } from './types.ts'

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

    it('no longer declares showReferenceAlleles', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-2b',
        showReferenceAlleles: true,
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('skip')
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

  describe('renderingMode config slot', () => {
    it('has default value of alleleCount', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-7',
      })
      expect(readConfObject(config, 'renderingMode')).toBe('alleleCount')
    })

    it('can be set to phased', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-8',
        renderingMode: 'phased',
      })
      expect(readConfObject(config, 'renderingMode')).toBe('phased')
    })
  })

  describe('minorAlleleFrequencyFilter config slot', () => {
    it('has default value of 0', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-9',
      })
      expect(readConfObject(config, 'minorAlleleFrequencyFilter')).toBe(0)
    })

    it('can be set to a custom value', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-10',
        minorAlleleFrequencyFilter: 0.05,
      })
      expect(readConfObject(config, 'minorAlleleFrequencyFilter')).toBe(0.05)
    })
  })

  describe('maxMissingnessFilter config slot', () => {
    it('defaults to 1 (keep every variant)', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-missingness-default',
      })
      expect(readConfObject(config, 'maxMissingnessFilter')).toBe(1)
    })

    it('can be set to a custom value', () => {
      const config = configSchema.create({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'test-missingness-custom',
        maxMissingnessFilter: 0.2,
      })
      expect(readConfObject(config, 'maxMissingnessFilter')).toBe(0.2)
    })
  })
})

describe('rowColor config object', () => {
  const configSchema = configSchemaFactory()

  it('colours by the rows themselves by default', () => {
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

// The attribute palette and its application, the two halves the `sources`
// getter resolves: the palette is dealt over the adapter rows so a subtree
// filter cannot re-rank it, and painted onto whatever rows are being drawn.
describe('attributeColorDeal', () => {
  const sources = [
    { name: 'sample1', population: 'EUR' },
    { name: 'sample2', population: 'AFR' },
    { name: 'sample3', population: 'EUR' },
  ]
  const NO_ENTRIES = { domain: [], range: [] }
  const colorsOf = (rows: Source[]) =>
    rowColorScale(rows, attributeColorDeal('population', NO_ENTRIES, rows))

  it('deals nothing when no attribute paints', () => {
    expect(attributeColorDeal('', NO_ENTRIES, sources)).toBeUndefined()
  })

  it('gives each value of the attribute its own color', () => {
    const colors = colorsOf(sources)
    expect(colors.get('sample1')).toBeDefined()
    expect(colors.get('sample1')).toBe(colors.get('sample3'))
    expect(colors.get('sample1')).not.toBe(colors.get('sample2'))
  })

  // Ranked by how many rows carry each value, which is why the model deals
  // this over the adapter rows: over the drawn ones, focusing a clade would
  // re-rank the values and recolor everything left on screen.
  it('ranks by how many rows carry each value', () => {
    const colors = colorsOf(sources)
    const oneAfr = colorsOf([sources[1]!])
    expect(oneAfr.get('sample2')).not.toBe(colors.get('sample2'))
    expect(oneAfr.get('sample2')).toBe(colors.get('sample1'))
  })

  it('pairs a listed value with its range colour', () => {
    const colors = rowColorScale(
      sources,
      attributeColorDeal(
        'population',
        { domain: ['AFR'], range: ['#123456'] },
        sources,
      ),
    )
    expect(colors.get('sample2')).toBe('#123456')
  })

  // silently: the warning lives in the actions, because this runs inside a
  // computed and a computed must not console.warn per menu render
  it('deals nothing, silently, when the requested attribute is absent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(attributeColorDeal('nonexistent', NO_ENTRIES, sources)).toBe(
      undefined,
    )
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('applyAttributeColors', () => {
  const colors = new Map([
    ['a', 'blue'],
    ['b', 'red'],
  ])

  it('tints each row by name', () => {
    const rows: Source[] = [
      { name: 'a', population: 'EUR' },
      { name: 'b', population: 'AFR' },
    ]
    expect(applyAttributeColors(rows, colors).map(s => s.labelColor)).toEqual([
      'blue',
      'red',
    ])
  })

  // A channel bound to a variable beats a per-row constant — a samplesTsv
  // `color` column.
  it('wins over a color the row already carried', () => {
    const [row] = applyAttributeColors(
      [{ name: 'a', population: 'EUR', labelColor: 'green' }],
      colors,
    )
    expect(row!.labelColor).toBe('blue')
  })

  it('leaves a row the palette has no answer for alone', () => {
    const [row] = applyAttributeColors(
      [{ name: 'c', population: 'SAS', labelColor: 'green' }],
      colors,
    )
    expect(row!.labelColor).toBe('green')
  })
})
