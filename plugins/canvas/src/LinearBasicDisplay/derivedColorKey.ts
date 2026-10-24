import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'

import { fieldColorCandidates } from '../shared/fieldColorCandidates.ts'

import type {
  ColorValues,
  FeatureDataResult,
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
  const { rectFeatureIndices, flatbushItems } = data
  return paintedWhere(data, i => {
    const item = flatbushItems[rectFeatureIndices[i]!]
    return !!item && onScreen.has(item.featureId)
  })
}

/**
 * `data` with its color values narrowed to those a rect overlapping one of
 * `spans` paints, for a key over parts of a feature: a domain off screen
 * names no family though its gene is on screen.
 */
export function colorValuesInSpans<
  T extends Pick<
    FeatureDataResult,
    'colorValues' | 'rectColorValues' | 'rectPositions'
  >,
>(data: T, spans: readonly { start: number; end: number }[]): T {
  const { rectPositions } = data
  return paintedWhere(data, i =>
    spans.some(
      ({ start, end }) =>
        rectPositions[i * 2]! < end && rectPositions[i * 2 + 1]! > start,
    ),
  )
}

function paintedWhere<
  T extends Pick<FeatureDataResult, 'colorValues' | 'rectColorValues'>,
>(data: T, shows: (rect: number) => boolean): T {
  const { colorValues, rectColorValues } = data
  if (!colorValues) {
    return data
  }
  const shown = new Set<number>()
  for (let i = 0; i < rectColorValues.length; i++) {
    const value = rectColorValues[i]!
    if (value > 0 && shows(i)) {
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
 * `data` with the `transcriptFeatures` color's values in place of the feature
 * color's, so the key and palette code reads the domains' lane as its own.
 */
export function domainLaneOf<
  T extends Pick<
    FeatureDataResult,
    | 'colorValues'
    | 'rectColorValues'
    | 'domainColorValues'
    | 'rectDomainColorValues'
  >,
>(data: T): T {
  return {
    ...data,
    colorValues: data.domainColorValues,
    rectColorValues: data.rectDomainColorValues ?? new Uint32Array(0),
  }
}
