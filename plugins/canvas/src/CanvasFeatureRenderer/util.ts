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
 * Optimized to minimize readConfObject calls by checking isCallback first
 */
export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
  color1,
  color3,
  isColor1Callback,
  isColor3Callback,
}: {
  feature: Feature
  config: AnyConfigurationModel
  colorByCDS: boolean
  theme: Theme
  color1?: string
  color3?: string
  isColor1Callback?: boolean
  isColor3Callback?: boolean
}) {
  // Determine fill color based on UTR status
  // Only use readConfObject if the color is a callback (feature-dependent)
  let fill: string
  if (isUTR(feature)) {
    fill = isColor3Callback
      ? readConfObject(config, 'color3', { feature })
      : (color3 ?? readConfObject(config, 'color3'))
  } else {
    fill = isColor1Callback
      ? readConfObject(config, 'color1', { feature })
      : (color1 ?? readConfObject(config, 'color1'))
  }

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
 * Optimized to accept pre-read config values to avoid repeated readConfObject calls
 */
export function chooseGlyphType({
  feature,
  config,
  transcriptTypes,
  containerTypes,
}: {
  feature: Feature
  config?: AnyConfigurationModel
  transcriptTypes?: string[]
  containerTypes?: string[]
}): GlyphType {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')

  // Read from config only if not provided (for backward compatibility)
  const transcriptTypesArray = transcriptTypes ?? (config ? readConfObject(config, 'transcriptTypes') : [])
  const containerTypesArray = containerTypes ?? (config ? readConfObject(config, 'containerTypes') : [])

  if (subfeatures?.length && type !== 'CDS') {
    const hasSubSub = subfeatures.some(f => f.get('subfeatures')?.length)
    const hasCDS = subfeatures.some(f => f.get('type') === 'CDS')
    if (transcriptTypesArray.includes(type) && hasCDS) {
      return 'ProcessedTranscript'
    } else if (
      (!feature.parent() && hasSubSub) ||
      containerTypesArray.includes(type)
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
