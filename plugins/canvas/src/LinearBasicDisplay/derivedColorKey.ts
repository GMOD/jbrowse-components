import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'

import { colorValueLabel } from '../RenderFeatureDataRPC/featureColors.ts'

import type { FeatureColorScale } from '../RenderFeatureDataRPC/featureColors.ts'
import type {
  FeatureDataResult,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

/**
 * The key a color channel's scale derives from what the worker painted, less a
 * color only a hidden section carries: `derivedColorScale` over the candidates
 * the walk recorded, which is the same derivation every channel-backed key
 * runs.
 */
export function derivedColorKey(
  scale: FeatureColorScale,
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
    {
      id: 'color',
      field: scale.field,
      domain: scale.domain,
      labelOf: value => colorValueLabel(scale.field, value),
    },
  )
}
