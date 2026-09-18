import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { categoricalField } from '@jbrowse/core/util/categoricalField'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own. Pure fallbacks, never compared against a
// stored value. They live in core because the multi-sample variant display's
// lane paints an uncolored record with the same goldenrod.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = utrDefaultColor

export interface ColorScaleSettings {
  colorField: string
  colorDomain: readonly string[]
  colorPalette: readonly string[]
}

/**
 * The color channel's field, or undefined while `colorField` is empty and the
 * `color` slot paints.
 */
export function featureColorScale({
  colorField,
  colorDomain,
  colorPalette,
}: ColorScaleSettings) {
  return colorField
    ? categoricalField(colorField, {
        domain: colorDomain,
        palette: colorPalette,
      })
    : undefined
}
