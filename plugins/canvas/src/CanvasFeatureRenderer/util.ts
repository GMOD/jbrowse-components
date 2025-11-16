import { readConfObject } from '@jbrowse/core/configuration'
import { getFrame } from '@jbrowse/core/util'

import type { GlyphType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

/**
 * Determines if a feature is an untranslated region (UTR)
 */
export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}

/**
 * Get the appropriate color for a box feature based on its properties
 */
export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  colorByCDS: boolean
  theme: Theme
}) {
  let fill: string = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })

  const featureType: string | undefined = feature.get('type')
  const featureStrand: -1 | 1 | undefined = feature.get('strand')
  const featurePhase: 0 | 1 | 2 | undefined = feature.get('phase')

  if (
    colorByCDS &&
    featureType === 'CDS' &&
    featureStrand !== undefined &&
    featurePhase !== undefined
  ) {
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')

    const frame = getFrame(
      featureStart,
      featureEnd,
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }

  return fill
}

/**
 * Selects the appropriate glyph type to render a feature based on its
 * type and structure
 */
export function chooseGlyphType({
  feature,
  config,
}: {
  feature: Feature
  config: AnyConfigurationModel
}): GlyphType {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  const transcriptTypes = readConfObject(config, 'transcriptTypes')
  const containerTypes = readConfObject(config, 'containerTypes')

  if (subfeatures?.length && type !== 'CDS') {
    const hasSubSub = subfeatures.some(f => f.get('subfeatures')?.length)
    const hasCDS = subfeatures.some(f => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return 'ProcessedTranscript'
    } else if (
      (!feature.parent() && hasSubSub) ||
      containerTypes.includes(type)
    ) {
      return 'Subfeatures'
    } else {
      return 'Segments'
    }
  } else if (type === 'CDS') {
    return 'CDS'
  } else {
    return 'Box'
  }
}
