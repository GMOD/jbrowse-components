import { drawCDSBackground } from '../peptides/drawCDSBackground.ts'
import { drawPeptidesOnCDS } from '../peptides/drawPeptidesOnCDS.ts'
import { prepareAminoAcidData } from '../peptides/prepareAminoAcidData.ts'
import { readCachedConfig } from '../renderConfig.ts'
import { getBoxColor, isOffScreen } from '../util.ts'
import {
  shouldRenderPeptideBackground,
  shouldRenderPeptideText,
} from '../zoomThresholds.ts'
import { boxGlyph } from './box.ts'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

export const cdsGlyph: Glyph = {
  type: 'CDS',

  match(feature) {
    return feature.get('type') === 'CDS'
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, displayMode, featureHeight } = configContext

    const height = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeight = displayMode === 'compact' ? height / 2 : height
    const width = (feature.get('end') - feature.get('start')) / bpPerPx

    return {
      feature,
      glyphType: 'CDS',
      x: 0,
      y: 0,
      width,
      height: baseHeight,
      totalLayoutHeight: baseHeight,
      totalLayoutWidth: width,
      leftPadding: 0,
      children: [],
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { feature } = layout
    const {
      region,
      bpPerPx,
      configContext,
      theme,
      canvasWidth,
      peptideDataMap,
    } = dc
    const { config } = configContext
    const colorByCDS = dc.colorByCDS ?? false
    const reversed = region.reversed ?? false

    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const strand = feature.get('strand') as number
    const width = layout.width
    const left = layout.x
    const top = layout.y
    const height = layout.height

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
      // Fall back to box drawing
      boxGlyph.draw(ctx, { ...layout, glyphType: 'Box' }, dc)
    }
  },
}
