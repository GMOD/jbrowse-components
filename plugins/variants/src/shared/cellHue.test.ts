import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'

import VariantsPlugin from '../index.ts'
import { ALT_HUE } from './cellFill.ts'
import {
  cellHueRead,
  cellHueReaderOf,
  cellPaintOf,
  sameHueRead,
} from './cellHue.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
import { IMPACT_FIELD, getVariantImpactColor } from './variantConsequence.ts'

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

function reader(
  encoding: ColorEncoding | undefined,
  renderingMode = 'alleleCount',
) {
  return cellHueReaderOf(cellHueRead(encoding), {
    jexl: pluginManager.jexl,
    renderingMode,
  })
}

// What the worker reads off a variant, painted the way the main thread does
function hue(encoding: ColorEncoding | undefined) {
  const { value } = reader(encoding)
  const paint = cellPaintOf(encoding)
  return (feature: Feature) => {
    const read = value?.(feature)
    return read !== undefined && paint.hueOf
      ? paint.hueOf(read)
      : paint.constant
  }
}

function key(encoding: ColorEncoding | undefined) {
  const { value } = reader(encoding)
  const { keyOf } = cellPaintOf(encoding)
  return (feature: Feature) => keyOf?.(value!(feature)!)
}

describe('what the worker reads', () => {
  test('nothing for the genotype colours or a constant', () => {
    expect(cellHueRead(undefined)).toBeUndefined()
    expect(cellHueRead('#123456')).toBeUndefined()
    expect(reader('#123456')).toEqual({})
  })

  test('a jexl callback whole, since only the worker can run it', () => {
    expect(cellHueRead("jexl:'#abcdef'")).toBe("jexl:'#abcdef'")
    expect(reader("jexl:'#abcdef'").value?.(variant({}))).toBe('#abcdef')
  })

  test('a field without its scale, so recolouring it refetches nothing', () => {
    const categorical = cellHueRead({
      field: 'INFO.AF',
      scale: 'categorical',
      domain: ['0.1'],
      range: ['#aa0000'],
    })
    const threshold = cellHueRead({
      field: 'INFO.AF',
      scale: 'threshold',
      domain: ['0.01'],
    })
    expect(categorical).toEqual({ field: 'INFO.AF' })
    expect(sameHueRead(categorical, threshold)).toBe(true)
    expect(sameHueRead(categorical, { field: 'INFO.DP' })).toBe(false)
    expect(sameHueRead(categorical, undefined)).toBe(false)
  })

  test('the phaseSet preset is a flag, and only in phased mode', () => {
    const field = { field: PHASE_SET_FIELD, scale: 'categorical' as const }
    expect(reader(field, 'phased')).toEqual({ byPhaseSet: true })
    expect(reader(field)).toEqual({ byPhaseSet: false })
    expect(cellPaintOf(field)).toEqual({})
  })
})

test('a CSS colour paints every variant', () => {
  expect(hue('#123456')(variant({}))).toBe('#123456')
})

test('a jexl callback paints the colour it returns', () => {
  expect(hue("jexl:'#abcdef'")(variant({}))).toBe('#abcdef')
})

test('the impact preset paints the consequence tier colours', () => {
  const encoding = { field: IMPACT_FIELD, scale: 'categorical' as const }
  const v = variant({ ANN: ['T|missense_variant|MODERATE|G'] })
  expect(hue(encoding)(v)).toBe(getVariantImpactColor(v))
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
  expect(hue(encoding)(del)).toBe('#e41a1c')
  expect(hue(encoding)(variant({}))).toBe(ALT_HUE)
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
    expect(color).toBe(ALT_HUE)
    expect(color).not.toBe(NO_CATEGORY_COLOR)
  })

  test('honours a declared domain and range', () => {
    const color = hue({ ...clnsig, domain: ['Pathogenic'], range: ['#aa0000'] })
    expect(color(variant({ CLNSIG: ['Pathogenic'] }))).toBe('#aa0000')
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
    expect(color(variant({ AF: [0.0005] }))).toBe('#aa0000')
    expect(color(variant({ AF: [0.005] }))).toBe('#00aa00')
    expect(color(variant({ AF: [0.2] }))).toBe('#0000aa')
    expect(color(variant({ AF: [1e-7] }))).toBe('#aa0000')
    expect(color(variant({ AF: [undefined] }))).toBe(ALT_HUE)
  })

  test('reads a jexl expression as the field', () => {
    expect(
      key({ field: "jexl:get(feature,'REF')", scale: 'categorical' })(
        variant({}),
      ),
    ).toBe('A')
  })
})
