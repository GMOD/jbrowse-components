import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'

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
