import { readConfObject } from '@jbrowse/core/configuration'
import { getFrame, stripAlpha } from '@jbrowse/core/util'

import type { RenderConfigContext } from './renderConfig'
import type { GlyphType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

const MAX_LABEL_LENGTH = 50

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}

export function getBoxColor({
  feature,
  config,
  configContext,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  theme: Theme
}) {
  const { color1, color3, isColor1Callback, isColor3Callback } = configContext

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

export function chooseGlyphType({
  feature,
  configContext,
}: {
  feature: Feature
  configContext: RenderConfigContext
}): GlyphType {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  const { transcriptTypes, containerTypes } = configContext

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

export function getStrokeColor({
  feature,
  config,
  configContext,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  theme: Theme
}) {
  const { color2, isColor2Callback } = configContext
  const c = isColor2Callback
    ? readConfObject(config, 'color2', { feature })
    : (color2 ?? readConfObject(config, 'color2'))
  return c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
}
