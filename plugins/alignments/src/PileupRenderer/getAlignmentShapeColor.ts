import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util'
import { fillColor } from '../shared/color'
import {
  colorByInsertSize,
  colorByMappingQuality,
  colorByOrientation,
  colorByStrand,
  colorByStrandedRnaSeq,
} from './colorBy'

export function getAlignmentShapeColor({
  colorType,
  tag,
  feature,
  config,
  defaultColor,
  colorTagMap,
}: {
  colorType: string
  tag: string
  feature: Feature
  defaultColor: boolean
  config: AnyConfigurationModel
  colorTagMap: Record<string, string>
}) {
  // first pass for simple color changes that change the color of the
  // alignment
  switch (colorType) {
    case 'insertSize':
      return colorByInsertSize(feature)
    case 'strand':
      return colorByStrand(feature)
    case 'mappingQuality':
      return colorByMappingQuality(feature)
    case 'pairOrientation':
      return colorByOrientation(feature, config)
    case 'stranded':
      return colorByStrandedRnaSeq(feature)
    case 'xs':
    case 'tag': {
      const tags = feature.get('tags')
      const val = tags ? tags[tag] : feature.get(tag)

      if (tag === 'XS' || tag === 'TS') {
        return fillColor[
          {
            '-': 'color_rev_strand' as const,
            '+': 'color_fwd_strand' as const,
          }[val as '-' | '+'] || 'color_nostrand'
        ]
      } else if (tag === 'ts') {
        return fillColor[
          {
            '-':
              feature.get('strand') === -1
                ? ('color_fwd_strand' as const)
                : ('color_rev_strand' as const),
            '+':
              feature.get('strand') === -1
                ? ('color_rev_strand' as const)
                : ('color_fwd_strand' as const),
          }[val as '-' | '+'] || 'color_nostrand'
        ]
      } else {
        return colorTagMap[val] || fillColor['color_nostrand']
      }
    }
    case 'insertSizeAndPairOrientation':
      break

    case 'modifications':
    case 'methylation':
      // this coloring is similar to igv.js, and is helpful to color negative
      // strand reads differently because their c-g will be flipped (e.g. g-c
      // read right to left)
      return feature.get('flags') & 16 ? '#c8dcc8' : '#c8c8c8'

    default:
      return defaultColor
        ? 'lightgrey'
        : readConfObject(config, 'color', { feature })
  }
}
