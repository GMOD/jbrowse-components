import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig.ts'

import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { RenderConfigContext } from './renderConfig.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
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
