import { resolvePalette } from '@jbrowse/core/ui/palette'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { resolveRegionColors } from '../LinearBasicDisplay/components/resolveRegionColors.ts'
import { createTestEnvironment } from '../LinearBasicDisplay/testEnv.ts'
import { resolveOutlineColor } from './collect/glyphColors.ts'
import {
  LITERAL,
  OUTLINE,
  STROKE,
  cdsFrameClass,
  codonStripeClass,
  themedColorTable,
} from './colorClasses.ts'
import { THEME_DERIVED_COLOR } from './renderConfig.ts'
import { makeFeatureData, mockDisplayConfig } from './testUtils.ts'
import { getBoxColor, getStrokeColor } from './util.ts'

const jexl = createJexlInstance()
const palette = resolvePalette()

// The worker holds no palette, so every one of these used to be a color it baked
// from `theme` in the RPC payload — and every field of that payload is a cache
// key, so a light/dark toggle refetched every visible region.
describe('the worker emits a class where it cannot resolve a color', () => {
  it('paints a CDS by reading frame as a frame class, not a color', () => {
    const cds = new SimpleFeature({
      uniqueId: 'c1',
      refName: 'ctgA',
      type: 'CDS',
      start: 0,
      end: 30,
      strand: 1,
      phase: 0,
    })
    const { color, colorClass } = getBoxColor({
      feature: cds,
      config: mockDisplayConfig(),
      colorByCDS: true,
      jexl,
    })
    expect(color).toBeUndefined()
    expect(colorClass).toBe(cdsFrameClass(1))
  })

  it('keeps a literal color when colorByCDS is off', () => {
    const cds = new SimpleFeature({
      uniqueId: 'c1',
      refName: 'ctgA',
      type: 'CDS',
      start: 0,
      end: 30,
      strand: 1,
      phase: 0,
    })
    const { color, colorClass } = getBoxColor({
      feature: cds,
      config: mockDisplayConfig({ color: 'red' }),
      colorByCDS: false,
      jexl,
    })
    expect(color).toBe('red')
    expect(colorClass).toBe(LITERAL)
  })

  it('classes the connector stroke when connectorColor is unset', () => {
    const feature = new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 0,
      end: 10,
    })
    const stroke = getStrokeColor({
      feature,
      config: mockDisplayConfig(),
      jexl,
    })
    expect(stroke.color).toBeUndefined()
    expect(stroke.colorClass).toBe(STROKE)
  })

  it('classes the outline only for the theme-derived sentinel', () => {
    expect(resolveOutlineColor(THEME_DERIVED_COLOR)).toEqual({
      outlineColor: 0,
      outlineColorClass: OUTLINE,
    })
    expect(resolveOutlineColor('')).toEqual({
      outlineColor: 0,
      outlineColorClass: LITERAL,
    })
    expect(resolveOutlineColor('red')).toEqual({
      outlineColor: cssColorToABGR('red'),
      outlineColorClass: LITERAL,
    })
  })

  // The codon stripe is two tints of the box it sits on, so a frame-colored box
  // makes the stripes theme-derived too — the one derivation the class table has
  // to carry rather than leave the worker to compute.
  it('gives a frame-colored codon stripe its own tint classes', () => {
    const frame = cdsFrameClass(-2)
    expect(codonStripeClass(frame, false)).not.toBe(frame)
    expect(codonStripeClass(frame, true)).not.toBe(
      codonStripeClass(frame, false),
    )
    expect(codonStripeClass(LITERAL, true)).toBe(LITERAL)
  })
})

describe('the main thread resolves the classes', () => {
  it('gives every class a packed color', () => {
    const table = themedColorTable(palette)
    expect(table[STROKE]).toBe(cssColorToABGR(palette.text.secondary))
    expect(table[cdsFrameClass(1)]).toBe(
      cssColorToABGR(palette.framesCDS.at(1)!.main),
    )
    expect(table[codonStripeClass(cdsFrameClass(1), false)]).not.toBe(0)
  })

  it('hands an unthemed region back by reference', () => {
    const data = makeFeatureData()
    expect(resolveRegionColors(data, themedColorTable(palette))).toBe(data)
  })

  it('writes the themed lanes and leaves the literal ones alone', () => {
    const table = themedColorTable(palette)
    const data = makeFeatureData({
      rectColors: new Uint32Array([0, 0xff_00_00_ff]),
      rectColorClasses: new Uint8Array([STROKE, LITERAL]),
      outlineColorClass: OUTLINE,
    })
    const resolved = resolveRegionColors(data, table)
    expect([...resolved.rectColors]).toEqual([table[STROKE], 0xff_00_00_ff])
    expect(resolved.outlineColor).toBe(table[OUTLINE])
  })
})

// The payload, not a toggle: the test session's palette is fixed, and the
// payload is where the invalidation lived. Every field of `rpcProps()` is an RPC
// cache key, so while the theme was one of them a light/dark switch —
// `SettingsInvalidate` -> `invalidateSettings()` -> refetch — re-downloaded and
// re-parsed every visible region of every canvas feature track.
describe('the theme is not an RPC cache key', () => {
  it('sends no theme in the worker payload', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.rpcProps()).not.toHaveProperty('theme')
  })
})
