import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'
import { readCachedConfig } from './renderConfig'

import type { RenderConfigContext } from './renderConfig'
import type { GlyphType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function isOffScreen(left: number, width: number, canvasWidth: number) {
  return left + width < 0 || left > canvasWidth
}

export function isUTR(feature: Feature) {
  return UTR_REGEX.test(feature.get('type') || '')
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
  const { color1, color3 } = configContext

  let fill: string
  fill = isUTR(feature)
    ? readCachedConfig(color3, config, 'color3', feature)
    : readCachedConfig(color1, config, 'color1', feature)

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

function getSubfeatures(feature: Feature): Feature[] | undefined {
  return feature.get('subfeatures')
}

function hasCDSChild(subfeatures: Feature[]) {
  return subfeatures.some(f => f.get('type') === 'CDS')
}

function hasNestedSubfeatures(subfeatures: Feature[]) {
  return subfeatures.some(f => getSubfeatures(f)?.length)
}

function isTopLevel(feature: Feature) {
  return !feature.parent?.()
}

function isCodingTranscript(
  type: string,
  subfeatures: Feature[],
  transcriptTypes: string[],
) {
  return transcriptTypes.includes(type) && hasCDSChild(subfeatures)
}

function isContainer(
  feature: Feature,
  type: string,
  subfeatures: Feature[],
  containerTypes: string[],
) {
  if (containerTypes.includes(type)) {
    return true
  }
  return isTopLevel(feature) && hasNestedSubfeatures(subfeatures)
}

/**
 * Determine which glyph type to use for rendering a feature.
 *
 * Glyph types:
 * - Box: Simple rectangular feature with no children
 * - CDS: Coding sequence with optional amino acid coloring
 * - Segments: Feature with children connected by lines (e.g., exons)
 * - ProcessedTranscript: Like Segments, but synthesizes UTRs from exon/CDS
 * - Subfeatures: Container with independently-rendered children (e.g., gene with transcripts)
 */
export function chooseGlyphType({
  feature,
  configContext,
}: {
  feature: Feature
  configContext: RenderConfigContext
}): GlyphType {
  const type = feature.get('type') as string
  if (type === 'CDS') {
    return 'CDS'
  }

  const subfeatures = getSubfeatures(feature)
  if (!subfeatures?.length) {
    return 'Box'
  }

  const { transcriptTypes, containerTypes } = configContext

  if (isCodingTranscript(type, subfeatures, transcriptTypes)) {
    return 'ProcessedTranscript'
  }

  if (isContainer(feature, type, subfeatures, containerTypes)) {
    return 'Subfeatures'
  }

  return 'Segments'
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
  configContext,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  theme: Theme
}) {
  const { color2 } = configContext
  const c = readCachedConfig(color2, config, 'color2', feature)
  return c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
}
