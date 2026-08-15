import { getLuminance, resolvePalette } from '@jbrowse/core/ui/palette'

import { rgb255 } from '../LinearAlignmentsDisplay/colorUtils.ts'
import { buildColorPaletteFromPalette } from '../LinearAlignmentsDisplay/components/alignmentComponentUtils.ts'
import { toRgb } from './colors.ts'

import type { ColorPalette } from './colors.ts'

// The plugin's neutral overlays: marks that deliberately carry no category, so
// "neutral" is the theme's foreground and not a colour of their own.
// `flatConnectorTheme.test.ts` made this argument for the read cloud's flat
// connector; these two were the marks it did not reach, and both were still
// spelling neutral as a literal black in BOTH renderers — invisible in review
// because every figure is captured in light mode.
//
// The overlap tint is the one where black is not merely low-contrast but
// self-defeating: collapsed group rows deliberately leave spans unmerged so the
// tint STACKS and depth reads as weight, and a tint composing toward the ground
// it sits on stacks to nothing.
const KEYS = [
  'colorConnectingLine',
  'colorOverlapTint',
] as const satisfies readonly (keyof ColorPalette)[]

const light = buildColorPaletteFromPalette(
  resolvePalette({ themeName: 'lightStock' }),
)
const dark = buildColorPaletteFromPalette(
  resolvePalette({ themeName: 'darkStock' }),
)

describe.each(KEYS)('%s follows the theme', key => {
  // The property is not "it is some particular colour" but that the mark
  // contrasts with the track under it, so a theme retuning `text.primary` stays
  // free to move it.
  it('is dark on a light background and light on a dark one', () => {
    expect(getLuminance(rgb255(light[key]))).toBeLessThan(0.5)
    expect(getLuminance(rgb255(dark[key]))).toBeGreaterThan(0.5)
  })

  // Every existing figure is safe: light `text.primary` is `rgba(0,0,0,0.87)`,
  // whose RGB is the black that was hard-coded, and `toRgb` drops the alpha in
  // favour of each mark's own (CONNECTING_LINE_ALPHA, OVERLAP_ALPHA). So this
  // changes dark mode and nothing else.
  it('leaves light mode on the exact colour it already painted', () => {
    expect(light[key]).toEqual([0, 0, 0])
  })

  // The regression itself. A hard-coded black passes the light half above and
  // fails only here, which is why the two are separate assertions.
  it('is not the black both renderers used to hard-code', () => {
    expect(dark[key]).not.toEqual([0, 0, 0])
  })

  it.each([
    ['lightStock', light],
    ['darkStock', dark],
  ] as const)('is %s text.primary', (themeName, built) => {
    expect(built[key]).toEqual(
      toRgb(resolvePalette({ themeName }).text.primary),
    )
  })
})

// The chain-mode overlap fill is the counterexample that keeps the tint honest:
// it is an OPAQUE fill between two read fills rather than a stacking wash, so it
// takes `readOverlap` — a charcoal/off-white pair — and not the foreground.
// Sharing one slot between the two would have been the obvious simplification
// and is the wrong one.
describe('the chain overlap fill stays its own neutral', () => {
  it.each([
    ['lightStock', light],
    ['darkStock', dark],
  ] as const)('is %s readOverlap, not text.primary', (themeName, built) => {
    expect(built.colorOverlap).toEqual(
      toRgb(resolvePalette({ themeName }).readOverlap),
    )
    expect(built.colorOverlap).not.toEqual(built.colorOverlapTint)
  })
})
