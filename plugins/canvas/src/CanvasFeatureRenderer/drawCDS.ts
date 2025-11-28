import { drawBox } from './drawBox'
import { drawCDSBackground } from './drawCDSBackground'
import { drawPeptidesOnCDS } from './drawPeptidesOnCDS'
import { prepareAminoAcidData } from './prepareAminoAcidData'
import { getBoxColor } from './util'
import {
  shouldRenderPeptideBackground,
  shouldRenderPeptideText,
} from './zoomThresholds'

import type { DrawFeatureArgs } from './types'

export function drawCDS(args: DrawFeatureArgs) {
  const {
    ctx,
    feature,
    featureLayout,
    bpPerPx,
    config,
    configContext,
    theme,
    reversed,
    peptideDataMap,
    colorByCDS = false,
  } = args

  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand') as number
  const width = featureLayout.width
  const left = featureLayout.x
  const top = featureLayout.y
  const height = featureLayout.height

  if (left + width < 0) {
    return
  }

  const parent = feature.parent() ?? feature
  const peptideData = peptideDataMap?.get(parent.id())
  const protein = peptideData?.protein
  const doRenderBackground =
    shouldRenderPeptideBackground(bpPerPx) && colorByCDS && !!protein

  if (doRenderBackground) {
    const aggregatedAminoAcids = prepareAminoAcidData(
      parent,
      protein,
      featureStart,
      featureEnd,
      strand,
    )

    const baseColor = getBoxColor({
      feature,
      config,
      configContext,
      colorByCDS,
      theme,
    })

    drawCDSBackground({
      ctx,
      aggregatedAminoAcids,
      baseColor,
      left,
      top,
      width,
      height,
      bpPerPx,
      strand,
      reversed,
    })

    if (shouldRenderPeptideText(bpPerPx)) {
      drawPeptidesOnCDS({
        ctx,
        aggregatedAminoAcids,
        left,
        top,
        width,
        height,
        bpPerPx,
        strand,
        reversed,
      })
    }
  } else {
    drawBox(args)
  }
}
