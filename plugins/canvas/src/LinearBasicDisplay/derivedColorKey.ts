import { legendIsReadable } from '@jbrowse/core/ui/legendSpec'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { compareGroupKeys } from '@jbrowse/core/util/groupKeys'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/markEncoding'

import { colorValueLabel } from '../RenderFeatureDataRPC/featureColors.ts'

import type { FeatureColorScale } from '../RenderFeatureDataRPC/featureColors.ts'
import type {
  FeatureDataResult,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

/**
 * The key a color channel's scale derives from what the worker painted: every
 * value in `regions` sorted, the scale's domain ahead of the rest and the
 * no-value row last, less a value only a hidden section painted. No key while the values are one color
 * or too many to read.
 */
export function derivedColorKey(
  scale: FeatureColorScale,
  regions: Iterable<Pick<FeatureDataResult, 'colorKey'>>,
  isHidden?: (section: SectionStamp) => boolean,
): ColorScale[] {
  const colors = new Map<string, string>()
  for (const { colorKey } of regions) {
    for (const { rowIndex, label, color } of colorKey?.candidates ?? []) {
      const section = colorKey!.rows[rowIndex]
      if (!colors.has(label) && !(isHidden && section && isHidden(section))) {
        colors.set(label, abgrToCssRgba(color))
      }
    }
  }
  const entries = [...colors]
    .sort(
      ([a], [b]) =>
        Number(a === NO_VALUE_LABEL) - Number(b === NO_VALUE_LABEL) ||
        compareGroupKeys(a, b),
    )
    .map(([value, color]) => ({
      value,
      label: colorValueLabel(scale.field, value),
      color,
    }))
  return legendIsReadable(entries)
    ? [
        {
          kind: 'categorical',
          id: 'color',
          title: scale.field,
          domain: scale.domain,
          entries,
        },
      ]
    : []
}
