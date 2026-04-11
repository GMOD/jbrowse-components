import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { readConfigValue } from './renderConfig.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
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
  configContext,
  colorByCDS,
  theme,
}: {
  feature: Feature
  configContext: RenderConfigContext
  colorByCDS: boolean
  theme: Theme
}) {
  const { config } = configContext

  let fill =
    (isUTR(feature)
      ? readConfigValue<string>(config, 'color3', feature)
      : readConfigValue<string>(config, 'color1', feature)) ?? 'goldenrod'

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
  configContext,
  theme,
}: {
  feature: Feature
  configContext: RenderConfigContext
  theme: Theme
}) {
  const c =
    readConfigValue<string>(configContext.config, 'color2', feature) ?? '#f0f'
  return c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
}
