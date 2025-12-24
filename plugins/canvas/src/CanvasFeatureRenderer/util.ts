import { readStaticConfObject } from '@jbrowse/core/configuration'
import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'

import type { JexlLike, RenderConfigContext } from './renderConfig'
import type { GlyphType } from './types'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

const MAX_LABEL_LENGTH = 50

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function readFeatureLabels(
  configSnapshot: Record<string, any>,
  feature: Feature,
  jexl: JexlLike,
) {
  return {
    name: String(
      readStaticConfObject(
        configSnapshot,
        ['labels', 'name'],
        { feature },
        jexl,
      ) || '',
    ),
    description: String(
      readStaticConfObject(
        configSnapshot,
        ['labels', 'description'],
        { feature },
        jexl,
      ) || '',
    ),
  }
}

export function readLabelColors(
  configSnapshot: Record<string, any>,
  feature: Feature,
  theme: Theme,
  jexl: JexlLike,
) {
  return {
    nameColor: String(
      readStaticConfObject(
        configSnapshot,
        ['labels', 'nameColor'],
        { feature, theme },
        jexl,
      ) || '',
    ),
    descriptionColor: String(
      readStaticConfObject(
        configSnapshot,
        ['labels', 'descriptionColor'],
        { feature, theme },
        jexl,
      ) || '',
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
  configSnapshot,
  colorByCDS,
  theme,
  jexl,
}: {
  feature: Feature
  configSnapshot: Record<string, any>
  configContext: RenderConfigContext
  colorByCDS: boolean
  theme: Theme
  jexl: JexlLike
}) {
  let fill = isUTR(feature)
    ? readStaticConfObject(configSnapshot, 'color3', { feature, theme }, jexl)
    : readStaticConfObject(configSnapshot, 'color1', { feature, theme }, jexl)

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
  configSnapshot,
}: {
  feature: Feature
  glyphType: GlyphType
  configSnapshot: Record<string, any>
}): Feature[] {
  if (glyphType === 'ProcessedTranscript') {
    return getSubparts(feature, configSnapshot)
  }
  return feature.get('subfeatures') || []
}

export function getStrokeColor({
  feature,
  configSnapshot,
  theme,
  jexl,
}: {
  feature: Feature
  configSnapshot: Record<string, any>
  configContext: RenderConfigContext
  theme: Theme
  jexl: JexlLike
}) {
  const c = readStaticConfObject(
    configSnapshot,
    'color2',
    { feature, theme },
    jexl,
  )
  return c ?? stripAlpha(theme.palette.text.secondary)
}
