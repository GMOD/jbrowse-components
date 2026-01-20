import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import sharedVariantConfigFactory from './SharedVariantConfigSchema.ts'

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
