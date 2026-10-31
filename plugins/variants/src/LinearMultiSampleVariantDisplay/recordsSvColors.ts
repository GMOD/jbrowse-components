import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import {
  SV_TYPE_FIELD,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'

import { getCachedABGR } from '../shared/variantWebglUtils.ts'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'

function svClassField() {
  return categoricalField(SV_TYPE_FIELD)
}

/**
 * Each record's color while no `encoding.color` is picked: its SV class's,
 * through the `svType` preset the cells' "Color by → SV type" paints with,
 * and a record with no SV class the feature track's `featureDefaultColor`. A
 * record is not a genotype, so it takes none of the genotype colors.
 */
export function svClassColors(featureInfo: readonly VariantFeatureInfo[]) {
  const field = svClassField()
  const colorOf = new Map<string, number>([
    ['', getCachedABGR(featureDefaultColor)],
  ])
  return Uint32Array.from(featureInfo, ({ svType }) => {
    const known = colorOf.get(svType)
    const color = known ?? getCachedABGR(field.color(field.key(svType)))
    colorOf.set(svType, color)
    return color
  })
}

/** The SV classes `featureInfo` holds, one each, skipping its other records. */
export function svClassesOf(featureInfo: readonly VariantFeatureInfo[]) {
  const classes = new Set<string>()
  for (const { svType } of featureInfo) {
    if (svType !== '') {
      classes.add(svType)
    }
  }
  return classes
}

/** The key for the SV classes the band's records hold, in the preset order. */
export function svClassScale(svTypes: Iterable<string>): CategoricalScale {
  const field = svClassField()
  const keys = [...new Set([...svTypes].map(t => field.key(t)))]
    .filter(key => key !== '')
    .sort(field.compare)
  return {
    kind: 'categorical',
    id: 'records',
    title: 'SV type',
    entries: keys.map(key => ({
      value: key,
      label: field.label(key),
      color: field.color(key),
    })),
  }
}
