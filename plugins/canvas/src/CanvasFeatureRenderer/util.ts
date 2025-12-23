import { readConfObject } from '@jbrowse/core/configuration'
import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'

import type { RenderConfigContext } from './renderConfig'
import type { GlyphType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

const MAX_LABEL_LENGTH = 50

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function readFeatureLabels(
  config: AnyConfigurationModel,
  feature: Feature,
) {
  return {
    name: String(readConfObject(config, ['labels', 'name'], { feature }) || ''),
    description: String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    ),
  }
}

export function readLabelColors(
  config: AnyConfigurationModel,
  feature: Feature,
  theme: Theme,
) {
  return {
    nameColor: String(
      readConfObject(config, ['labels', 'nameColor'], { feature, theme }) || '',
    ),
    descriptionColor: String(
      readConfObject(config, ['labels', 'descriptionColor'], {
        feature,
        theme,
      }) || '',
    ),
  }
}

/**
 * Build tooltip string from mouseOver, label, and description.
 * Used by both CanvasFeatureRendering and FloatingLabels to ensure consistency.
 */
export function buildFeatureTooltip({
  mouseOver,
  label,
  description,
}: {
  mouseOver?: string
  label?: string
  description?: string
}) {
  if (mouseOver) {
    return mouseOver
  }
  const parts: string[] = []
  if (label && /\S/.test(label)) {
    parts.push(label)
  }
  if (description && /\S/.test(description)) {
    parts.push(description)
  }
  return parts.length > 0 ? parts.join('<br/>') : undefined
}

export function isOffScreen(left: number, width: number, canvasWidth: number) {
  return left + width < 0 || left > canvasWidth
}

export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}

export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  theme: Theme
}) {
  let fill = isUTR(feature)
    ? readConfObject(config, 'color3', {
        feature,
        theme,
      })
    : readConfObject(config, 'color1', {
        feature,
        theme,
      })

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
      (!feature.parent?.() && hasSubSub) ||
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

export function getChildFeatures({
  feature,
  glyphType,
  config,
}: {
  feature: Feature
  glyphType: GlyphType
  config: AnyConfigurationModel
}): Feature[] {
  if (glyphType === 'ProcessedTranscript') {
    return getSubparts(feature, config)
  }
  return feature.get('subfeatures') || []
}

export function getStrokeColor({
  feature,
  config,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  theme: Theme
}) {
  const c = readConfObject(config, 'color2', {
    feature,
    theme,
  })
  return c ?? stripAlpha(theme.palette.text.secondary)
}
