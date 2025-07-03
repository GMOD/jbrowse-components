import { readConfObject } from '@jbrowse/core/configuration'
import { getFrame } from '@jbrowse/core/util'

import { isUTR } from './isUTR'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

/**
 * Get the appropriate color for a box feature based on its properties
 * @param feature - The genomic feature
 * @param config - The configuration model
 * @param colorByCDS - Whether to color by CDS frame
 * @param theme - Material UI theme object
 * @returns The color string to use for the feature
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
}): string {
  // Get the basic color based on UTR status
  let fill: string = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })

  // If coloring by CDS and this is a CDS feature with strand and phase
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

    // Calculate the frame and get the corresponding color
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
