import { drawBox } from './drawBox'
import { drawCDSBackground } from './drawCDSBackground'
import { drawPeptidesOnCDS } from './drawPeptidesOnCDS'
import { prepareAminoAcidData } from './prepareAminoAcidData'
import { getBoxColor } from './util'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a CDS feature with optional peptide rendering on the canvas
 */
export function drawCDS(args: DrawFeatureArgs): DrawingResult {
  const {
    ctx,
    feature,
    featureLayout,
    region,
    bpPerPx,
    config,
    theme,
    reversed,
    peptideDataMap,
    colorByCDS = false,
  } = args
  const { start, end } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand') as number
  const width = featureLayout.width
  const left = featureLayout.x
  const top = featureLayout.y
  const height = featureLayout.height

  const coords: number[] = []
  const items: DrawingResult['items'] = []

  if (left + width < 0) {
    return { coords, items }
  }

  const zoomedInEnoughForBackground = 1 / bpPerPx >= 1
  const zoomedInEnoughForText = 1 / bpPerPx >= 8

  // Get peptide data for the parent feature (transcript)
  const parent = feature.parent() ?? feature
  const peptideData = peptideDataMap?.get(parent.id())
  const protein = peptideData?.protein
  const doRenderBackground =
    zoomedInEnoughForBackground && colorByCDS && !!protein

  // Get the base CDS color (frame-based coloring if colorByCDS is on)
  const baseColor = getBoxColor({
    feature,
    config,
    colorByCDS,
    theme,
  })

  // If we have peptide data and should render amino acid backgrounds
  if (doRenderBackground) {
    const aggregatedAminoAcids = prepareAminoAcidData(
      parent,
      protein,
      featureStart,
      featureEnd,
      strand,
    )

    // Draw the alternating amino acid background colors
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

    // Draw the amino acid text labels on top (only if zoomed in enough)
    if (zoomedInEnoughForText) {
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

      // Add to spatial index
      const leftWithinBlock = Math.max(left, 0)
      const widthWithinBlock = Math.max(
        2,
        Math.min(width, screenWidth - leftWithinBlock),
      )
      coords.push(
        leftWithinBlock,
        top,
        leftWithinBlock + widthWithinBlock,
        top + height,
      )
      items.push({
        featureId: feature.id(),
        type: 'cds',
        startBp: featureStart,
        endBp: featureEnd,
        topPx: top,
        bottomPx: top + height,
      })
    }
    return { coords, items }
  } else {
    // Fall back to regular box drawing if peptide rendering is not available or failed
    return drawBox(args)
  }
}
