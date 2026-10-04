import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'

import VariantsPlugin from '../index.ts'
import { ALT_HUE } from './cellFill.ts'
import { cellHueOf, cellHueReaderOf, sameHueRead } from './cellHue.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
import { paintFeatureColors } from './paintCells.ts'
import { IMPACT_FIELD, getVariantImpactColor } from './variantConsequence.ts'
import { getCachedABGR as abgr } from './variantWebglUtils.ts'

import type { Feature } from '@jbrowse/core/util'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

const pluginManager = new PluginManager([new VariantsPlugin()])
pluginManager.createPluggableElements()
pluginManager.configure()

function variant(info: Record<string, unknown>, id = 'v') {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'chr1',
    start: 0,
    end: 1,
    REF: 'A',
    ALT: ['T'],
    INFO: info,
  })
}

const read = (encoding: ColorEncoding | undefined, keptField?: string) =>
  cellHueOf(encoding, keptField).read

function reader(encoding: ColorEncoding | undefined, unit = 'sample') {
  return cellHueReaderOf(read(encoding), {
    jexl: pluginManager.jexl,
    unit,
  })
}

// What the worker reads off one variant, painted as the main thread paints
// the lane
function hue(encoding: ColorEncoding | undefined) {
  const { value } = reader(encoding)
  return (feature: Feature) => {
    const v = value?.(feature)
    return paintFeatureColors(
      {
        featureColorValues: Uint32Array.from([v === undefined ? 0 : 1]),
        colorValues: v === undefined ? [] : [v],
        paintedColorValues: [],
      },
      cellHueOf(encoding),
      true,
    )[0]
  }
}

function key(encoding: ColorEncoding | undefined) {
  const { value } = reader(encoding)
  const { keyOf } = cellHueOf(encoding)
  return (feature: Feature) => keyOf?.(value!(feature)!)
}

describe('what the worker reads', () => {
  test('nothing for the genotype colours or a constant', () => {
    expect(read(undefined)).toBeUndefined()
    expect(read('#123456')).toBeUndefined()
    expect(reader('#123456')).toEqual({})
  })

  test('a jexl callback whole, since only the worker can run it', () => {
    expect(read("jexl:'#abcdef'")).toBe("jexl:'#abcdef'")
    expect(reader("jexl:'#abcdef'").value?.(variant({}))).toBe('#abcdef')
  })

  test('a field without its scale, so recolouring it refetches nothing', () => {
    const categorical = read({
      field: 'INFO.AF',
      scale: 'categorical',
      domain: ['0.1'],
      range: ['#aa0000'],
    })
    const threshold = read({
      field: 'INFO.AF',
      scale: 'threshold',
      domain: ['0.01'],
    })
    expect(categorical).toEqual({ field: 'INFO.AF' })
    expect(sameHueRead(categorical, threshold)).toBe(true)
    expect(sameHueRead(categorical, { field: 'INFO.DP' })).toBe(false)
    expect(sameHueRead(categorical, undefined)).toBe(false)
  })

  test('the field kept for the way back, so returning to it refetches nothing', () => {
    expect(read('#123456', 'INFO.AF')).toEqual({ field: 'INFO.AF' })
    expect(read(undefined, 'INFO.AF')).toEqual({ field: 'INFO.AF' })
    expect(read(undefined, PHASE_SET_FIELD)).toBeUndefined()
    expect(cellHueOf('#123456', 'INFO.AF').constant).toBe('#123456')
    expect(cellHueOf(undefined, 'INFO.AF').hueOf).toBeUndefined()
  })

  test('the phaseSet preset is a flag, and only in phased mode', () => {
    const field = { field: PHASE_SET_FIELD, scale: 'categorical' as const }
    expect(reader(field, 'haplotype')).toEqual({ byPhaseSet: true })
    expect(reader(field)).toEqual({ byPhaseSet: false })
    expect(cellHueOf(field)).toEqual({ read: { field: PHASE_SET_FIELD } })
  })
})

test('a CSS colour paints every variant', () => {
  expect(hue('#123456')(variant({}))).toBe(abgr('#123456'))
})

test('a jexl callback paints the colour it returns', () => {
  expect(hue("jexl:'#abcdef'")(variant({}))).toBe(abgr('#abcdef'))
})

test('the impact preset paints the consequence tier colours', () => {
  const encoding = { field: IMPACT_FIELD, scale: 'categorical' as const }
  const v = variant({ ANN: ['T|missense_variant|MODERATE|G'] })
  expect(hue(encoding)(v)).toBe(abgr(getVariantImpactColor(v)))
  expect(key(encoding)(v)).toBe('MODERATE')
})

test('svType paints the class colours, and a record with no class the alt hue', () => {
  const encoding = { field: SV_TYPE_FIELD, scale: 'categorical' as const }
  const del = new SimpleFeature({
    uniqueId: 'd',
    refName: 'chr1',
    start: 0,
    end: 1,
    svType: 'DEL',
  })
  expect(key(encoding)(del)).toBe('DEL')
  expect(hue(encoding)(del)).toBe(abgr('#e41a1c'))
  expect(hue(encoding)(variant({}))).toBe(abgr(ALT_HUE))
})

describe('a record field', () => {
  const clnsig = { field: 'INFO.CLNSIG', scale: 'categorical' as const }

  test('keys each variant by its value', () => {
    expect(key(clnsig)(variant({ CLNSIG: ['Pathogenic'] }))).toBe('Pathogenic')
  })

  test('gives each value one colour, the same for every variant', () => {
    const color = hue(clnsig)
    const a = color(variant({ CLNSIG: ['Pathogenic'] }, 'a'))
    const b = color(variant({ CLNSIG: ['Pathogenic'] }, 'b'))
    const c = color(variant({ CLNSIG: ['Benign'] }, 'c'))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  // The no-value grey sat next to the reference grey once dosage shading
  // lifted it, so a record the field says nothing about keeps the alt hue.
  test('leaves a variant with no value on the default alt hue', () => {
    const color = hue(clnsig)(variant({}))
    expect(color).toBe(abgr(ALT_HUE))
    expect(color).not.toBe(abgr(NO_CATEGORY_COLOR))
  })

  test('honours a declared domain and range', () => {
    const color = hue({ ...clnsig, domain: ['Pathogenic'], range: ['#aa0000'] })
    expect(color(variant({ CLNSIG: ['Pathogenic'] }))).toBe(abgr('#aa0000'))
  })

  test('cuts a number into the threshold bins from the value as text', () => {
    const encoding = {
      field: 'INFO.AF',
      scale: 'threshold' as const,
      domain: ['0.001', '0.01'],
      range: ['#aa0000', '#00aa00', '#0000aa'],
    }
    const color = hue(encoding)
    expect(key(encoding)(variant({ AF: [0.0005] }))).toBe('< 0.001')
    expect(color(variant({ AF: [0.0005] }))).toBe(abgr('#aa0000'))
    expect(color(variant({ AF: [0.005] }))).toBe(abgr('#00aa00'))
    expect(color(variant({ AF: [0.2] }))).toBe(abgr('#0000aa'))
    expect(color(variant({ AF: [1e-7] }))).toBe(abgr('#aa0000'))
    expect(color(variant({ AF: [undefined] }))).toBe(abgr(ALT_HUE))
  })

  test('deals values the hash puts on one hue a hue each, whatever their order', () => {
    const values = ['TEC', 'snRNA', 'protein_coding']
    const hues = (order: string[]) => {
      const cellHue = cellHueOf(
        { field: 'INFO.BIOTYPE', scale: 'categorical' },
        undefined,
        new Map(),
      )
      cellHue.deal!(order)
      return values.map(cellHue.hueOf!)
    }
    expect(new Set(hues(values)).size).toBe(3)
    expect(hues([...values].reverse())).toEqual(hues(values))
  })

  test('reads a jexl expression as the field', () => {
    expect(
      key({ field: "jexl:get(feature,'REF')", scale: 'categorical' })(
        variant({}),
      ),
    ).toBe('A')
  })
})
