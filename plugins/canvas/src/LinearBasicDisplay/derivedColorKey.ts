import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'

import type {
  FeatureDataResult,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'

/**
 * The key a color channel derives from what the worker painted, less a color
 * only a hidden section carries.
 */
export function derivedColorKey(
  field: CategoricalField,
  regions: Iterable<Pick<FeatureDataResult, 'colorKey'>>,
  isHidden?: (section: SectionStamp) => boolean,
): ColorScale[] {
  return derivedColorScale(
    regions,
    ({ colorKey }) => ({
      candidates: colorKey?.candidates ?? [],
      rowPaintsCandidateColor: rowIndex => {
        const section = colorKey?.rows[rowIndex]
        return !(isHidden && section && isHidden(section))
      },
    }),
    { id: 'color', field },
  )
}
