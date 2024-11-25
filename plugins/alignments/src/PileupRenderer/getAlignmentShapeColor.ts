import { readConfObject } from '@jbrowse/core/configuration'
import {
  colorByInsertSize,
  colorByMappingQuality,
  colorByOrientation,
  colorByStrand,
  colorByStrandedRnaSeq,
} from './colorBy'
import { fillColor } from '../shared/color'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

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
        if (val === '-') {
          return fillColor.color_rev_strand
        } else if (val === '+') {
          return fillColor.color_fwd_strand
        } else {
          return fillColor.color_nostrand
        }
      }
      if (tag === 'ts') {
        if (val === '-') {
          return feature.get('strand') === -1
            ? fillColor.color_fwd_strand
            : fillColor.color_rev_strand
        } else if (val === '+') {
          return feature.get('strand') === -1
            ? fillColor.color_rev_strand
            : fillColor.color_fwd_strand
        } else {
          return fillColor.color_nostrand
        }
      }
      return colorTagMap[val] || fillColor.color_nostrand
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
