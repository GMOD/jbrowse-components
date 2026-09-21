import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own. Pure fallbacks, never compared against a
// stored value. They live in core because the multi-sample variant display's
// lane paints an uncolored record with the same goldenrod.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = utrDefaultColor

/**
 * The color channel's field, or undefined while `color.value` paints: no
 * field named, or `scale: 'none'` beside one.
 */
export function featureColorScale(
  color: Pick<ColorSetting, 'field' | 'scale' | 'domain' | 'palette'>,
) {
  const { field, domain, palette } = color
  return paintedScale(color, 'categorical') === 'categorical'
    ? categoricalField(field, { domain, range: palette })
    : undefined
}
