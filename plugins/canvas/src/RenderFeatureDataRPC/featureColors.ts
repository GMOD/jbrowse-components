import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own. Pure fallbacks, never compared against a
// stored value. They live in core because the multi-sample variant display's
// lane paints an uncolored record with the same goldenrod.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = utrDefaultColor

export const STRAND_FIELD = 'strand'

// Red forward and blue reverse, the vocabulary the synteny ribbons paint too.
const STRAND_DOMAIN = ['1', '-1', '0']
const STRAND_PALETTE = ['tomato', 'cornflowerblue', 'goldenrod']
const STRAND_LABELS: Record<string, string> = {
  '1': 'Forward strand',
  '-1': 'Reverse strand',
  '0': 'No strand',
}

export interface ColorScaleSettings {
  colorField: string
  colorDomain: readonly string[]
  colorPalette: readonly string[]
}

export interface FeatureColorScale {
  field: string
  domain: string[]
  palette: string[]
}

/**
 * The color channel's scale, or undefined while `colorField` is empty and the
 * `color` slot paints. Strand brings its own domain and palette where the
 * settings name none.
 */
export function featureColorScale({
  colorField,
  colorDomain,
  colorPalette,
}: ColorScaleSettings): FeatureColorScale | undefined {
  const strand = colorField === STRAND_FIELD
  return colorField
    ? {
        field: colorField,
        domain: colorDomain.length
          ? [...colorDomain]
          : strand
            ? STRAND_DOMAIN
            : [],
        palette: colorPalette.length
          ? [...colorPalette]
          : strand
            ? STRAND_PALETTE
            : [],
      }
    : undefined
}

export function colorValueLabel(field: string, value: string) {
  return (field === STRAND_FIELD ? STRAND_LABELS[value] : undefined) ?? value
}
