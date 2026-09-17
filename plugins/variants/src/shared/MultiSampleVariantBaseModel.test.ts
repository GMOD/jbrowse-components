import { readConfObject } from '@jbrowse/core/configuration'

import {
  maybeApplyColorByPalette,
  maybeApplyFacet,
  sortSourcesByAttribute,
} from './MultiSampleVariantBaseModel.ts'
import sharedVariantConfigFactory from './SharedVariantConfigSchema.ts'

describe('SharedVariantConfigSchema', () => {
  const configSchema = sharedVariantConfigFactory()

  // `showReferenceAlleles` was a second boolean whose only job was seeding this
  // one; it is gone, and this slot is the whole setting.
  describe('referenceDrawingMode config slot', () => {
    it("defaults to 'skip'", () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-1',
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('skip')
    })

    it("can be set to 'draw'", () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-2',
        referenceDrawingMode: 'draw',
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('draw')
    })

    it('no longer declares showReferenceAlleles', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-2b',
        showReferenceAlleles: true,
      })
      expect(readConfObject(config, 'referenceDrawingMode')).toBe('skip')
    })
  })

  describe('showRowLabels config slot', () => {
    it('has default value of true', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-3',
      })
      expect(readConfObject(config, 'showRowLabels')).toBe(true)
    })

    it('can be set to false', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-4',
        showRowLabels: false,
      })
      expect(readConfObject(config, 'showRowLabels')).toBe(false)
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

  describe('maxMissingnessFilter config slot', () => {
    it('defaults to 1 (keep every variant)', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-missingness-default',
      })
      expect(readConfObject(config, 'maxMissingnessFilter')).toBe(1)
    })

    it('can be set to a custom value', () => {
      const config = configSchema.create({
        type: 'SharedVariantDisplay',
        displayId: 'test-missingness-custom',
        maxMissingnessFilter: 0.2,
      })
      expect(readConfObject(config, 'maxMissingnessFilter')).toBe(0.2)
    })
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

// Guards the colorBy wiring (setSources / setColorBy -> maybeApplyColorByPalette):
// the display colors sample rows by the resolved `colorBy` value, or no-ops when
// colorBy is unset / the attribute is missing.
describe('maybeApplyColorByPalette', () => {
  const sources = [
    { name: 'sample1', population: 'EUR' },
    { name: 'sample2', population: 'AFR' },
    { name: 'sample3', population: 'EUR' },
  ]

  it('returns undefined when colorBy is unset (no palette applied)', () => {
    expect(maybeApplyColorByPalette('', sources)).toBeUndefined()
  })

  it('colors sources by the requested attribute', () => {
    const result = maybeApplyColorByPalette('population', sources)
    expect(result).toBeDefined()
    // same population => same color, different population => different color
    expect(result![0]!.labelColor).toBe(result![2]!.labelColor)
    expect(result![0]!.labelColor).not.toBe(result![1]!.labelColor)
  })

  // silently: the warning lives in applyArrangement (the action path), because
  // rowOrderIsCustom runs this inside a computed and a computed must not
  // console.warn per menu render
  it('returns undefined, silently, when the requested attribute is absent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(maybeApplyColorByPalette('nonexistent', sources)).toBe(undefined)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

// Guards the facet wiring (setSources / setFacet -> maybeApplyFacet): rows are
// reordered so each attribute value is contiguous, which is what makes a
// group-restricted genotype pattern read as one band rather than scattered rows.
describe('sortSourcesByAttribute', () => {
  const sources = [
    { name: 's1', pop: 'EUR' },
    { name: 's2', pop: 'AFR' },
    { name: 's3', pop: 'EUR' },
    { name: 's4', pop: 'AFR' },
    { name: 's5', pop: 'AFR' },
  ]

  it('makes each band contiguous, in sorted value order', () => {
    expect(sortSourcesByAttribute(sources, 'pop').map(s => s.name)).toEqual([
      's2',
      's4',
      's5',
      's1',
      's3',
    ])
  })

  it('is stable within a band (preserves prior arrangement)', () => {
    const result = sortSourcesByAttribute(sources, 'pop')
    expect(result.filter(s => s.pop === 'AFR').map(s => s.name)).toEqual([
      's2',
      's4',
      's5',
    ])
  })

  it('orders by value, not by band size', () => {
    const lopsided = [
      { name: 'a', pop: 'ZZZ' },
      { name: 'b', pop: 'ZZZ' },
      { name: 'c', pop: 'AAA' },
    ]
    expect(sortSourcesByAttribute(lopsided, 'pop').map(s => s.name)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('puts a domain value first, whatever it sorts as', () => {
    expect(
      sortSourcesByAttribute(sources, 'pop', ['EUR']).map(s => s.name),
    ).toEqual(['s1', 's3', 's2', 's4', 's5'])
  })

  it('leaves the values a domain does not list sorted behind it', () => {
    const three = [
      { name: 'a', pop: 'EUR' },
      { name: 'b', pop: 'SAS' },
      { name: 'c', pop: 'AFR' },
    ]
    expect(
      sortSourcesByAttribute(three, 'pop', ['SAS']).map(s => s.name),
    ).toEqual(['b', 'c', 'a'])
  })

  it('sorts sources missing the attribute last, in original order', () => {
    const mixed = [
      { name: 'x' },
      { name: 'y', pop: 'EUR' },
      { name: 'z' },
      { name: 'w', pop: 'EUR' },
    ]
    expect(sortSourcesByAttribute(mixed, 'pop').map(s => s.name)).toEqual([
      'y',
      'w',
      'x',
      'z',
    ])
  })
})

describe('maybeApplyFacet', () => {
  const sources = [
    { name: 's1', pop: 'EUR' },
    { name: 's2', pop: 'AFR' },
    { name: 's3', pop: 'EUR' },
  ]

  it('returns undefined when the field is unset (order untouched)', () => {
    expect(maybeApplyFacet('', [], sources)).toBeUndefined()
  })

  it('bands by the requested attribute', () => {
    expect(maybeApplyFacet('pop', [], sources)!.map(s => s.name)).toEqual([
      's2',
      's1',
      's3',
    ])
  })

  it("stacks the domain's values first", () => {
    expect(maybeApplyFacet('pop', ['EUR'], sources)!.map(s => s.name)).toEqual([
      's1',
      's3',
      's2',
    ])
  })

  // silent for the reason maybeApplyColorByPalette's absent case is
  it('returns undefined, silently, when the attribute is absent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(maybeApplyFacet('nonexistent', [], sources)).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
