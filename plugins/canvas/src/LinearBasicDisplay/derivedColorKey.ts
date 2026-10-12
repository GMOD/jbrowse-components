import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'

import { fieldColorCandidates } from '../shared/fieldColorCandidates.ts'

import type {
  ColorValues,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { featureColorViews } from '../shared/featureColorViews.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'

/**
 * The key the color field derives from the values the worker found, each
 * painted through `field`, less a value only a hidden section carries. `order`
 * lists and names the rows: the facet's field where the facet reads the same
 * one, so the key runs in the sections' order. `title` heads the key, the
 * field's name unset.
 */
export function derivedColorKey(
  field: CategoricalField,
  regions: Iterable<{ colorValues?: ColorValues }>,
  isHidden?: (section: SectionStamp) => boolean,
  order: CategoricalField = field,
  title?: string,
): ColorScale[] {
  return derivedColorScale(
    regions,
    fieldColorCandidates(field, ({ colorValues }, rowIndex) => {
      const section = colorValues?.rows[rowIndex]
      return !(isHidden && section && isHidden(section))
    }),
    { id: 'color', field: order, title },
  )
}

type FeatureColors = Pick<
  ReturnType<typeof featureColorViews>,
  | 'colorKeyTitle'
  | 'rampColorScales'
  | 'identityKeyEntries'
  | 'paintedColorField'
>

/**
 * The key a feature display's `color` object derives from what the worker
 * painted: a ramp's bar, an identity scale's `domain` colors once anything is
 * drawn, or the painted field's values (`derivedColorKey`), less those only a
 * hidden section painted and in the `order` a facet reading the same field
 * gives.
 */
export function featureColorKey(
  colors: FeatureColors,
  regions: readonly { colorValues?: ColorValues; rectPositions: Uint32Array }[],
  {
    isHidden,
    order,
  }: {
    isHidden?: (section: SectionStamp) => boolean
    order?: (scale: CategoricalField) => CategoricalField
  } = {},
): ColorScale[] {
  const { colorKeyTitle } = colors
  const ramp = colors.rampColorScales('color')
  if (ramp.length > 0) {
    return ramp
  }
  const identity = colors.identityKeyEntries
  if (identity.length > 0) {
    return regions.some(data => data.rectPositions.length > 0)
      ? [
          {
            kind: 'categorical',
            id: 'color',
            ...(colorKeyTitle ? { title: colorKeyTitle } : {}),
            entries: identity,
          },
        ]
      : []
  }
  const scale = colors.paintedColorField
  return scale
    ? derivedColorKey(
        scale,
        regions,
        isHidden,
        order?.(scale) ?? scale,
        colorKeyTitle,
      )
    : []
}
