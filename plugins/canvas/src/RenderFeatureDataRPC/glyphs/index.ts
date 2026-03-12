import { boxGlyph } from './box.ts'
import { cdsGlyph } from './cds.ts'
import {
  hasMatureProteinChildren,
  matureProteinRegionGlyph,
} from './matureProteinRegion.ts'
import { processedTranscriptGlyph } from './processed.ts'
import { repeatRegionGlyph } from './repeatRegion.ts'
import { segmentsGlyph } from './segments.ts'
import { subfeaturesGlyph } from './subfeatures.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

export function findGlyph(
  feature: Feature,
  configContext: RenderConfigContext,
) {
  const type = feature.get('type') as string
  const subfeatures = feature.get('subfeatures')
  const hasSubfeatures = !!subfeatures?.length

  if (type === 'CDS') {
    return hasMatureProteinChildren(feature)
      ? matureProteinRegionGlyph
      : cdsGlyph
  }
  if (type === 'repeat_region' && hasSubfeatures) {
    return repeatRegionGlyph
  }
  if (hasSubfeatures) {
    const { containerTypes, transcriptTypes } = configContext
    if (containerTypes.includes(type)) {
      return subfeaturesGlyph
    }
    const hasCDS = subfeatures.some((f: Feature) => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return processedTranscriptGlyph
    }
    const isTopLevel = !feature.parent?.()
    const hasNested = subfeatures.some(
      (f: Feature) => f.get('subfeatures')?.length,
    )
    if (isTopLevel && hasNested) {
      return subfeaturesGlyph
    }
    return segmentsGlyph
  }
  return boxGlyph
}

export { boxGlyph } from './box.ts'
