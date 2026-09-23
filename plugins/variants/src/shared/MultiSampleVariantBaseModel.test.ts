import { readConfObject } from '@jbrowse/core/configuration'

import {
  applyColorByPalette,
  colorByPalette,
  maybeApplyFacet,
  sortSourcesByAttribute,
} from './MultiSampleVariantBaseModel.ts'
import sharedVariantConfigFactory from './SharedVariantConfigSchema.ts'

import type { Source } from './types.ts'

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

describe('rowColor config object', () => {
  const configSchema = sharedVariantConfigFactory()

  it('names no attribute by default', () => {
    const config = configSchema.create({
      type: 'SharedVariantDisplay',
      displayId: 'test-colorby-1',
    })
    expect(readConfObject(config, ['rowColor', 'field'])).toBe('')
  })

  it('can be set to a metadata attribute name', () => {
    const config = configSchema.create({
      type: 'SharedVariantDisplay',
      displayId: 'test-colorby-2',
      rowColor: 'population',
    })
    expect(readConfObject(config, ['rowColor', 'field'])).toBe('population')
  })
})

// The colorBy scale and its application, the two halves the `sources` getter
// resolves on every read: the scale is built over the adapter rows so a subtree
// filter cannot re-rank it, and painted onto whatever rows are being drawn.
describe('colorByPalette', () => {
  const sources = [
    { name: 'sample1', population: 'EUR' },
    { name: 'sample2', population: 'AFR' },
    { name: 'sample3', population: 'EUR' },
  ]

  it('returns undefined when colorBy is unset', () => {
    expect(colorByPalette('', sources)).toBeUndefined()
  })

  it('gives each value of the attribute its own color', () => {
    const palette = colorByPalette('population', sources)!
    expect(palette.get('EUR')).toBeDefined()
    expect(palette.get('EUR')).not.toBe(palette.get('AFR'))
  })

  // Ranked by how many rows carry each value, which is why the model resolves
  // this over the adapter rows: over the drawn ones, focusing a clade would
  // re-rank the values and recolor everything left on screen.
  it('ranks by how many rows carry each value', () => {
    const palette = colorByPalette('population', sources)!
    const oneAfr = colorByPalette('population', [sources[1]!])!
    expect(oneAfr.get('AFR')).not.toBe(palette.get('AFR'))
    expect(oneAfr.get('AFR')).toBe(palette.get('EUR'))
  })

  // silently: the warning lives in the actions, because this runs inside a
  // computed and a computed must not console.warn per menu render
  it('returns undefined, silently, when the requested attribute is absent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(colorByPalette('nonexistent', sources)).toBe(undefined)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('applyColorByPalette', () => {
  const palette = new Map([
    ['EUR', 'blue'],
    ['AFR', 'red'],
  ])

  it('tints each row by its value', () => {
    const rows: Source[] = [
      { name: 'a', population: 'EUR' },
      { name: 'b', population: 'AFR' },
    ]
    expect(
      applyColorByPalette(rows, 'population', palette).map(s => s.labelColor),
    ).toEqual(['blue', 'red'])
  })

  // A channel bound to a variable beats a per-row constant — a samplesTsv
  // `color` column, a color the arrangement dialog wrote, a palette an older
  // session persisted into `layout`.
  it('wins over a color the row already carried', () => {
    const [row] = applyColorByPalette(
      [{ name: 'a', population: 'EUR', labelColor: 'green' }],
      'population',
      palette,
    )
    expect(row!.labelColor).toBe('blue')
  })

  it('leaves a row the scale has no answer for alone', () => {
    const [row] = applyColorByPalette(
      [{ name: 'a', population: 'SAS', labelColor: 'green' }],
      'population',
      palette,
    )
    expect(row!.labelColor).toBe('green')
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
    expect(maybeApplyFacet(undefined, sources)).toBeUndefined()
  })

  it('bands by the requested attribute', () => {
    expect(
      maybeApplyFacet({ field: 'pop', domain: [] }, sources)!.map(s => s.name),
    ).toEqual(['s2', 's1', 's3'])
  })

  it("stacks the domain's values first", () => {
    expect(
      maybeApplyFacet({ field: 'pop', domain: ['EUR'] }, sources)!.map(
        s => s.name,
      ),
    ).toEqual(['s1', 's3', 's2'])
  })

  // silent for the reason `colorByPalette`'s absent case is
  it('returns undefined, silently, when the attribute is absent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      maybeApplyFacet({ field: 'nonexistent', domain: [] }, sources),
    ).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

// The row order moved into `rows`, and an undeclared slot is dropped in
// silence, so a config still naming `domain` would open in file order.
test('a domain slot on the display config fails the load, naming rows', () => {
  const configSchema = sharedVariantConfigFactory()
  expect(() =>
    configSchema.create({
      type: 'SharedVariantDisplay',
      displayId: 'stale-domain',
      domain: ['S1'],
    }),
  ).toThrow(/rows: \{ "domain"/)
})
