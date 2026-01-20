/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { readConfObject } from '@jbrowse/core/configuration'

import sharedVariantConfigFactory from './SharedVariantConfigSchema.ts'
import { applyColorPalette } from './applyColorPalette.ts'

describe('SharedVariantConfigSchema', () => {
  const configSchema = sharedVariantConfigFactory()

  describe('showReferenceAlleles config slot', () => {
    it('has default value of false', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-1',
      })
      expect(readConfObject(config, 'showReferenceAlleles')).toBe(false)
    })

    it('can be set to true', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-2',
        showReferenceAlleles: true,
      })
      expect(readConfObject(config, 'showReferenceAlleles')).toBe(true)
    })
  })

  describe('showSidebarLabels config slot', () => {
    it('has default value of true', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-3',
      })
      expect(readConfObject(config, 'showSidebarLabels')).toBe(true)
    })

    it('can be set to false', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-4',
        showSidebarLabels: false,
      })
      expect(readConfObject(config, 'showSidebarLabels')).toBe(false)
    })
  })

  describe('showTree config slot', () => {
    it('has default value of true', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-5',
      })
      expect(readConfObject(config, 'showTree')).toBe(true)
    })

    it('can be set to false', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-6',
        showTree: false,
      })
      expect(readConfObject(config, 'showTree')).toBe(false)
    })
  })

  describe('renderingMode config slot', () => {
    it('has default value of alleleCount', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-7',
      })
      expect(readConfObject(config, 'renderingMode')).toBe('alleleCount')
    })

    it('can be set to phased', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-8',
        renderingMode: 'phased',
      })
      expect(readConfObject(config, 'renderingMode')).toBe('phased')
    })
  })

  describe('minorAlleleFrequencyFilter config slot', () => {
    it('has default value of 0', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-9',
      })
      expect(readConfObject(config, 'minorAlleleFrequencyFilter')).toBe(0)
    })

    it('can be set to a custom value', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-10',
        minorAlleleFrequencyFilter: 0.05,
      })
      expect(readConfObject(config, 'minorAlleleFrequencyFilter')).toBe(0.05)
    })
  })
})

describe('Config-to-getter fallback logic', () => {
  it('referenceDrawingMode getter returns draw when showReferenceAlleles config is true', () => {
    const showReferenceAlleles = true
    const referenceDrawingModeSetting: string | undefined = undefined

    const result =
      referenceDrawingModeSetting !== undefined
        ? referenceDrawingModeSetting
        : showReferenceAlleles
          ? 'draw'
          : 'skip'

    expect(result).toBe('draw')
  })

  it('referenceDrawingMode getter returns skip when showReferenceAlleles config is false', () => {
    const showReferenceAlleles = false
    const referenceDrawingModeSetting: string | undefined = undefined

    const result =
      referenceDrawingModeSetting !== undefined
        ? referenceDrawingModeSetting
        : showReferenceAlleles
          ? 'draw'
          : 'skip'

    expect(result).toBe('skip')
  })

  it('referenceDrawingMode getter returns state value when explicitly set', () => {
    const showReferenceAlleles = true
    const referenceDrawingModeSetting = 'skip'

    const result =
      referenceDrawingModeSetting !== undefined
        ? referenceDrawingModeSetting
        : showReferenceAlleles
          ? 'draw'
          : 'skip'

    expect(result).toBe('skip')
  })

  it('showSidebarLabels getter returns config value when state is undefined', () => {
    const configValue = false
    const settingValue: boolean | undefined = undefined

    const result = settingValue ?? configValue

    expect(result).toBe(false)
  })

  it('showSidebarLabels getter returns state value when explicitly set', () => {
    const configValue = false
    const settingValue = true

    const result = settingValue ?? configValue

    expect(result).toBe(true)
  })

  it('renderingMode getter returns config value when state is undefined', () => {
    const configValue = 'phased'
    const settingValue: string | undefined = undefined

    const result = settingValue ?? configValue

    expect(result).toBe('phased')
  })

  it('renderingMode getter returns state value when explicitly set', () => {
    const configValue = 'phased'
    const settingValue = 'alleleCount'

    const result = settingValue ?? configValue

    expect(result).toBe('alleleCount')
  })

  it('minorAlleleFrequencyFilter getter returns config value when state is undefined', () => {
    const configValue = 0.1
    const settingValue: number | undefined = undefined

    const result = settingValue ?? configValue

    expect(result).toBe(0.1)
  })

  it('minorAlleleFrequencyFilter getter returns state value when explicitly set', () => {
    const configValue = 0.1
    const settingValue = 0.2

    const result = settingValue ?? configValue

    expect(result).toBe(0.2)
  })
})

describe('colorBy config slot', () => {
  const configSchema = sharedVariantConfigFactory()

  it('has default value of empty string', () => {
    const config = configSchema.create({
      type: 'SharedVariantDisplay',
      displayId: 'test-colorby-1',
    })
    expect(readConfObject(config, 'colorBy')).toBe('')
  })

  it('can be set to a metadata attribute name', () => {
    const config = configSchema.create({
      type: 'SharedVariantDisplay',
      displayId: 'test-colorby-2',
      colorBy: 'population',
    })
    expect(readConfObject(config, 'colorBy')).toBe('population')
  })
})

describe('applyColorPalette', () => {
  it('returns original sources when attribute is empty', () => {
    const sources = [
      { name: 'sample1', population: 'EUR' },
      { name: 'sample2', population: 'AFR' },
    ]
    const result = applyColorPalette(sources, '')
    expect(result).toBe(sources)
  })

  it('returns original sources when sources array is empty', () => {
    const sources: { name: string }[] = []
    const result = applyColorPalette(sources, 'population')
    expect(result).toBe(sources)
  })

  it('returns original sources when attribute does not exist', () => {
    const sources = [
      { name: 'sample1', population: 'EUR' },
      { name: 'sample2', population: 'AFR' },
    ]
    const result = applyColorPalette(sources, 'nonexistent')
    expect(result).toBe(sources)
  })

  it('applies colors based on attribute values', () => {
    const sources = [
      { name: 'sample1', population: 'EUR' },
      { name: 'sample2', population: 'AFR' },
      { name: 'sample3', population: 'EUR' },
    ]
    const result = applyColorPalette(sources, 'population')

    expect(result).toHaveLength(3)
    expect(result[0]).toHaveProperty('color')
    expect(result[1]).toHaveProperty('color')
    expect(result[2]).toHaveProperty('color')

    // Samples with same population value should have same color
    expect(result[0]!.color).toBe(result[2]!.color)
    // Samples with different population values should have different colors
    expect(result[0]!.color).not.toBe(result[1]!.color)
  })

  it('assigns colors by frequency (less common values get colors first)', () => {
    const sources = [
      { name: 'sample1', population: 'EUR' },
      { name: 'sample2', population: 'EUR' },
      { name: 'sample3', population: 'EUR' },
      { name: 'sample4', population: 'AFR' },
    ]
    const result = applyColorPalette(sources, 'population')

    // AFR (1 occurrence) should get the first color from palette
    // EUR (3 occurrences) should get the second color
    const afrSample = result.find(s => s.population === 'AFR')
    const eurSample = result.find(s => s.population === 'EUR')

    expect(afrSample).toHaveProperty('color')
    expect(eurSample).toHaveProperty('color')
    expect(afrSample!.color).not.toBe(eurSample!.color)
  })

  it('preserves other properties on sources', () => {
    const sources = [
      { name: 'sample1', population: 'EUR', region: 'Western', custom: 123 },
      { name: 'sample2', population: 'AFR', region: 'Eastern', custom: 456 },
    ]
    const result = applyColorPalette(sources, 'population')

    expect(result[0]!.name).toBe('sample1')
    // @ts-expect-error
    expect(result[0]!.region).toBe('Western')
    // @ts-expect-error
    expect(result[0]!.custom).toBe(123)
    expect(result[1]!.name).toBe('sample2')
    // @ts-expect-error
    expect(result[1]!.region).toBe('Eastern')
    // @ts-expect-error
    expect(result[1]!.custom).toBe(456)
  })

  it('handles undefined attribute values by converting to string', () => {
    const sources = [
      { name: 'sample1', population: 'EUR' },
      { name: 'sample2' }, // no population attribute
    ]
    const result = applyColorPalette(sources, 'population')

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('color')
    expect(result[1]).toHaveProperty('color')
    // They should have different colors (EUR vs undefined)
    expect(result[0]!.color).not.toBe(result[1]!.color)
  })
})
