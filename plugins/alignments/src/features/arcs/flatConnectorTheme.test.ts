import { getLuminance, resolvePalette } from '@jbrowse/core/ui/palette'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildColorPaletteFromPalette } from '../../LinearAlignmentsDisplay/components/alignmentComponentUtils.ts'
import { toRgb } from '../../shaders/colors.ts'

// The read cloud's flat connector is the one overlay mark with no category to
// paint — the insert-size / orientation colour lives in its two endpoint
// squares, and samplot.py's neutral joining line is what it mirrors. Both
// renderers spelled "neutral" as literal black, in a plugin whose history
// already records the dark-mode shape of that bug ("the overlay palettes
// ignored the theme the reads follow"), invisible in review because every
// figure is captured in light mode.
//
// So the property is not "it is some particular colour", it is that the line
// contrasts with the track under it. Asserted as luminance, so a theme that
// retunes `text.primary` stays free to move it.
const light = buildColorPaletteFromPalette(
  resolvePalette({ themeName: 'lightStock' }),
)
const dark = buildColorPaletteFromPalette(
  resolvePalette({ themeName: 'darkStock' }),
)

describe('the flat read-cloud connector follows the theme', () => {
  it('is dark on a light background and light on a dark one', () => {
    expect(getLuminance(rgb255(light.colorFlatConnector))).toBeLessThan(0.5)
    expect(getLuminance(rgb255(dark.colorFlatConnector))).toBeGreaterThan(0.5)
  })

  // Every existing figure is safe: light `text.primary` is `rgba(0,0,0,0.87)`,
  // whose RGB is the black that was hard-coded, and `toRgb` drops the token's
  // alpha in favour of ARC_FLAT_ALPHA — the same 0.7 the line already drew at.
  // So this changes dark mode and nothing else.
  it('leaves light mode on the exact colour it already painted', () => {
    expect(light.colorFlatConnector).toEqual([0, 0, 0])
  })

  // The regression itself. Hard-coded black passes the light half above and
  // fails only here, which is why the two are separate assertions.
  it('is not the black both renderers used to hard-code', () => {
    expect(dark.colorFlatConnector).not.toEqual([0, 0, 0])
  })

  // `text.primary` specifically — the token `ArcHoverOverlay` already strokes
  // its hover mark with, so the highlight drawn ON a connector and the
  // connector under it cannot end up two different neutrals.
  it.each([
    ['lightStock', light],
    ['darkStock', dark],
  ] as const)('is %s text.primary', (themeName, built) => {
    expect(built.colorFlatConnector).toEqual(
      toRgb(resolvePalette({ themeName }).text.primary),
    )
  })
})
