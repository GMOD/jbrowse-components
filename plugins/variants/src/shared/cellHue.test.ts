import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'

import VariantsPlugin from '../index.ts'
import { ALT_HUE } from './cellFill.ts'
import { cellHueOf } from './cellHue.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
import { IMPACT_FIELD, getVariantImpactColor } from './variantConsequence.ts'
import { SV_TYPE_FIELD } from './variantSvType.ts'

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

function hue(
  encoding: Parameters<typeof cellHueOf>[0],
  renderingMode = 'alleleCount',
) {
  return cellHueOf(encoding, {
    jexl: pluginManager.jexl,
    svTypeColors: { DEL: '#ff0000' },
    renderingMode,
  })
}

test('unset paints the genotype colours', () => {
  expect(hue(undefined)).toEqual({})
})

test('a CSS colour paints every variant', () => {
  expect(hue('#123456').color?.(variant({}))).toBe('#123456')
})

test('the impact preset reads the consequence tier natively', () => {
  const { color, domain } = hue({ field: IMPACT_FIELD, scale: 'categorical' })
  expect(color).toBe(getVariantImpactColor)
  expect(domain).toBeDefined()
})

test('the svType preset paints the palette dealt over the types present', () => {
  const { color } = hue({ field: SV_TYPE_FIELD, scale: 'categorical' })
  expect(color?.(variant({ SVTYPE: ['DEL'] }))).toBe('#ff0000')
})

test('the phaseSet preset is a flag, and only in phased mode', () => {
  const field = { field: PHASE_SET_FIELD, scale: 'categorical' as const }
  expect(hue(field, 'phased')).toEqual({ byPhaseSet: true })
  expect(hue(field)).toEqual({ byPhaseSet: false })
})

describe('a record field', () => {
  const clnsig = hue({ field: 'INFO.CLNSIG', scale: 'categorical' })

  test('keys each variant by its value', () => {
    expect(clnsig.domain?.(variant({ CLNSIG: ['Pathogenic'] }))).toBe(
      'Pathogenic',
    )
  })

  test('gives each value one colour, the same for every variant', () => {
    const a = clnsig.color?.(variant({ CLNSIG: ['Pathogenic'] }, 'a'))
    const b = clnsig.color?.(variant({ CLNSIG: ['Pathogenic'] }, 'b'))
    const c = clnsig.color?.(variant({ CLNSIG: ['Benign'] }, 'c'))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  // The no-value grey sat next to the reference grey once dosage shading
  // lifted it, so a record the field says nothing about keeps the alt hue.
  test('leaves a variant with no value on the default alt hue', () => {
    const color = clnsig.color?.(variant({}))
    expect(color).toBe(ALT_HUE)
    expect(color).not.toBe(NO_CATEGORY_COLOR)
  })

  test('honours a declared domain and range', () => {
    const { color } = hue({
      field: 'INFO.CLNSIG',
      scale: 'categorical',
      domain: ['Pathogenic'],
      range: ['#aa0000'],
    })
    expect(color?.(variant({ CLNSIG: ['Pathogenic'] }))).toBe('#aa0000')
  })

  test('cuts a number into the threshold bins', () => {
    const { color, domain } = hue({
      field: 'INFO.AF',
      scale: 'threshold',
      domain: ['0.001', '0.01'],
      range: ['#aa0000', '#00aa00', '#0000aa'],
    })
    expect(domain?.(variant({ AF: [0.0005] }))).toBe('< 0.001')
    expect(color?.(variant({ AF: [0.0005] }))).toBe('#aa0000')
    expect(color?.(variant({ AF: [0.005] }))).toBe('#00aa00')
    expect(color?.(variant({ AF: [0.2] }))).toBe('#0000aa')
    expect(color?.(variant({ AF: [undefined] }))).toBe(ALT_HUE)
  })

  test('reads a jexl expression as the field', () => {
    const { domain } = hue({
      field: "jexl:get(feature,'REF')",
      scale: 'categorical',
    })
    expect(domain?.(variant({}))).toBe('A')
  })
})
