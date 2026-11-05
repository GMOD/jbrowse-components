import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'

import { fieldColorCandidates } from '../shared/fieldColorCandidates.ts'
import { facetField, sectionIdsOf } from './facet.ts'

import type {
  ColorValues,
  FeatureDataResult,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { featureColorViews } from '../shared/featureColorViews.ts'
import type { FeatureFacet } from './facet.ts'
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

/**
 * `data` with its color values narrowed to those a box of an `onScreen`
 * feature paints, so a key names what the window shows rather than what the
 * fetch's buffer beyond it loaded. `values` stays whole: the deal of colors
 * reads it, and a value scrolling into view keeps the color it had.
 */
export function onScreenColorValues<
  T extends Pick<
    FeatureDataResult,
    'colorValues' | 'rectColorValues' | 'rectFeatureIndices' | 'flatbushItems'
  >,
>(data: T, onScreen: ReadonlySet<string>): T {
  const { colorValues, rectColorValues, rectFeatureIndices, flatbushItems } =
    data
  if (!colorValues) {
    return data
  }
  const shown = new Set<number>()
  for (let i = 0; i < rectColorValues.length; i++) {
    const value = rectColorValues[i]!
    const item = flatbushItems[rectFeatureIndices[i]!]
    if (value > 0 && item && onScreen.has(item.featureId)) {
      shown.add(value - 1)
    }
  }
  return {
    ...data,
    colorValues: {
      ...colorValues,
      painted: colorValues.painted.filter(p => shown.has(p.valueIndex)),
    },
  }
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

/**
 * What the key reads: a feature display's color views, its fetched regions,
 * the features on screen, its facet and the sections the user hid.
 */
export type FeatureColorScaleHost = FeatureColors &
  Pick<ReturnType<typeof featureColorViews>, 'categoricalColorField'> & {
    rpcDataMap: ReadonlyMap<
      number,
      Pick<
        FeatureDataResult,
        | 'colorValues'
        | 'rectColorValues'
        | 'rectFeatureIndices'
        | 'flatbushItems'
        | 'rectPositions'
      >
    >
    onScreenFeatureIds: ReadonlySet<string> | undefined
    facet: FeatureFacet | undefined
    hiddenGroups: ReadonlySet<string>
  }

/**
 * The key a feature display draws. The base model installs it as a
 * `.views()` layer; the tables export's static host installs the same.
 */
export function featureColorScaleViews(self: FeatureColorScaleHost) {
  return {
    /**
     * #getter
     * The key the color channel's scale derives from what the worker
     * painted, narrowed to the on-screen features where the window is known,
     * less the values only a hidden section painted, in the sections' order
     * where the facet reads the same field. An identity scale's key is its
     * `domain` colors whole, once anything is drawn.
     */
    get derivedColorScales(): ColorScale[] {
      const { facet, hiddenGroups, onScreenFeatureIds } = self
      const regions = [...self.rpcDataMap.values()]
      const sectionOf =
        facet && hiddenGroups.size > 0 ? sectionIdsOf(facet) : undefined
      return featureColorKey(
        self,
        onScreenFeatureIds
          ? regions.map(data => onScreenColorValues(data, onScreenFeatureIds))
          : regions,
        {
          isHidden:
            sectionOf && (section => hiddenGroups.has(sectionOf(section).key)),
          order:
            facet && facet.field === self.categoricalColorField?.field
              ? scale => ({
                  ...facetField(facet),
                  label: scale.label,
                  unknown: scale.unknown,
                })
              : undefined,
        },
      )
    },
  }
}
