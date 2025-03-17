import { readConfObject } from '@jbrowse/core/configuration'

import Box from './Box'
import ProcessedTranscript from './ProcessedTranscript'
import RepeatRegion from './RepeatRegion'
import Segments from './Segments'
import Subfeatures from './Subfeatures'

import type { ExtraGlyphValidator, Glyph } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export function chooseGlyphComponent({
  feature,
  extraGlyphs,
  config,
}: {
  feature: Feature
  config: AnyConfigurationModel
  extraGlyphs?: ExtraGlyphValidator[]
}): Glyph {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  const transcriptTypes = readConfObject(config, 'transcriptTypes')
  const containerTypes = readConfObject(config, 'containerTypes')

  if (type === 'repeat_region' && subfeatures?.length) {
    return RepeatRegion
  } else if (subfeatures?.length && type !== 'CDS') {
    const hasSubSub = subfeatures.some(f => f.get('subfeatures')?.length)
    const hasCDS = subfeatures.some(f => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return ProcessedTranscript
    } else if (
      (!feature.parent() && hasSubSub) ||
      containerTypes.includes(type)
    ) {
      return Subfeatures
    } else {
      return Segments
    }
  } else {
    return extraGlyphs?.find(f => f.validator(feature))?.glyph || Box
  }
}
