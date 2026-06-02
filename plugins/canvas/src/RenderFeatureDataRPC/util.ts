import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { THEME_DERIVED_COLOR, readConfigValue } from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

// True when the string contains at least one non-whitespace character.
export function hasVisibleText(text: string) {
  return /\S/.test(text)
}

export function isUTR(feature: Feature) {
  return UTR_REGEX.test(feature.get('type') ?? '')
}

// Case-insensitive: GFF3 mandates uppercase `CDS`, but lowercase `cds` shows up
// in real-world files. Centralizing avoids the dispatch path matching one case
// and the layout path matching another.
export function isCDS(feature: Feature) {
  return feature.get('type')?.toLowerCase() === 'cds'
}

export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: DisplayConfig
  colorByCDS: boolean
  theme: Theme
}) {
  let fill = isUTR(feature)
    ? readConfigValue<string>(config, 'utrColor', feature)
    : readConfigValue<string>(config, 'color', feature)

  const featureStrand = feature.get('strand')
  const featurePhase = feature.get('phase')

  if (
    colorByCDS &&
    isCDS(feature) &&
    (featureStrand === 1 || featureStrand === -1) &&
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
  theme,
}: {
  feature: Feature
  config: DisplayConfig
  theme: Theme
}) {
  const c = readConfigValue<string>(config, 'connectorColor', feature)
  return c === THEME_DERIVED_COLOR
    ? stripAlpha(theme.palette.text.secondary)
    : c
}
