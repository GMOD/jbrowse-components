import { drawBox } from './drawBox'
import { drawCDSBackground } from './drawCDSBackground'
import { drawPeptidesOnCDS } from './drawPeptidesOnCDS'
import { prepareAminoAcidData } from './prepareAminoAcidData'
import { getBoxColor, isOffScreen } from './util'
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
    configSnapshot,
    configContext,
    theme,
    jexl,
    reversed,
    canvasWidth,
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

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const parent = feature.parent?.() ?? feature
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
      configSnapshot,
      configContext,
      colorByCDS,
      theme,
      jexl,
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
      canvasWidth,
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
        canvasWidth,
      })
    }
  } else {
    drawBox(args)
  }
}
