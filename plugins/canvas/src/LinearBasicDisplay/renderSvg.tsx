import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import {
  Canvas2DFeatureRenderer,
  drawFeatureBlocks,
} from './components/Canvas2DFeatureRenderer.ts'
import { LABEL_FONT_SIZE } from './components/sharedRendererConstants.ts'
import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface RenderSvgModel {
  id: string
  height: number
  error: unknown
  regionTooLarge: boolean
  laidOutDataMap: Map<number, FeatureDataResult>
}

// Labels and amino-acid overlays are rendered as DOM/React overlays
// on-screen, so the on-screen renderer doesn't draw them. SVG export must
// bake them into the output, so they live here as a vector-only post-pass
// that runs after drawFeatureBlocks paints the geometry.
function renderLabels(
  ctx: Ctx2D,
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
) {
  const { floatingLabelsData } = data

  ctx.font = `${LABEL_FONT_SIZE}px sans-serif`

  for (const labelData of Object.values(floatingLabelsData)) {
    const featureStartBp = labelData.minX
    const featureEndBp = labelData.maxX

    if (featureEndBp < regionStart || featureStartBp > regionEnd) {
      continue
    }

    const px1 = bpToScreenPx(
      featureStartBp,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const px2 = bpToScreenPx(
      featureEndBp,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const featureLeftPx = Math.min(px1, px2)
    const featureRightPx = Math.max(px1, px2)
    const featureWidth = featureRightPx - featureLeftPx
    const featureBottomPx = labelData.topY + labelData.featureHeight

    const emitLabel = (
      label: {
        text: string
        relativeY: number
        color: string
        textWidth: number
        isOverlay?: boolean
      },
      padding: number,
    ) => {
      const labelY = featureBottomPx + label.relativeY + padding
      const labelX =
        label.textWidth > featureWidth
          ? featureLeftPx
          : Math.min(
              Math.max(Math.max(screenStartPx, featureLeftPx), 0),
              featureRightPx - label.textWidth,
            )

      if (label.isOverlay) {
        ctx.globalAlpha = 0.8
        ctx.fillStyle = 'rgb(255,255,255)'
        ctx.fillRect(
          labelX - 1,
          labelY,
          label.textWidth + 2,
          LABEL_FONT_SIZE + 1,
        )
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = label.color
      ctx.fillText(label.text, labelX, labelY + LABEL_FONT_SIZE)
    }

    if (labelData.nameLabel) {
      emitLabel(labelData.nameLabel, 2)
    }
    if (labelData.descriptionLabel) {
      emitLabel(labelData.descriptionLabel, 2)
    }
    if (labelData.subfeatureLabel) {
      emitLabel(labelData.subfeatureLabel, 0)
    }
  }
}

function renderPeptides(
  ctx: Ctx2D,
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
) {
  const { aminoAcidOverlay } = data
  if (!aminoAcidOverlay) {
    return
  }

  ctx.textAlign = 'center'
  for (const item of aminoAcidOverlay) {
    if (item.endBp < regionStart || item.startBp > regionEnd) {
      continue
    }

    const px1 = bpToScreenPx(
      item.startBp,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const px2 = bpToScreenPx(
      item.endBp,
      regionStart,
      regionEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const centerPx = (px1 + px2) / 2
    const fontSize = Math.min(item.heightPx, 16)
    const y = item.topPx + item.heightPx / 2 + fontSize / 3
    const cellWidthPx = Math.abs(px2 - px1)
    const label =
      cellWidthPx >= 20
        ? `${item.aminoAcid}${item.proteinIndex + 1}`
        : item.aminoAcid

    ctx.font = `${fontSize}px monospace`
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1
    ctx.strokeText(label, centerPx, y)
    ctx.fillStyle = item.isStopOrNonTriplet ? 'red' : 'black'
    ctx.fillText(label, centerPx, y)
  }
  ctx.textAlign = 'start'
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () =>
      model.laidOutDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  if (model.laidOutDataMap.size === 0) {
    return null
  }

  const visibleRegions = view.visibleRegions
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)
  const totalWidth = view.totalWidthPx
  const height = model.height

  // Headless renderer drives the same drawFeatureBlocks pipeline as on-screen.
  const renderer = new Canvas2DFeatureRenderer(null)
  for (const vr of visibleRegions) {
    const data = model.laidOutDataMap.get(vr.displayedRegionIndex)
    if (data) {
      renderer.uploadRegion(vr.displayedRegionIndex, data)
    }
  }

  const renderBlocks = buildRenderBlocks(visibleRegions)
  const featuresNode = paintLayer(totalWidth, height, opts, ctx => {
    drawFeatureBlocks(ctx, renderer.getRegions(), renderBlocks, {
      scrollY: 0,
      canvasWidth: totalWidth,
      canvasHeight: height,
    })
  })
  // Labels + peptides always vector — text should remain crisp even when
  // rasterizeLayers is on.
  const textNode = paintLayer(totalWidth, height, undefined, ctx => {
    for (const vr of visibleRegions) {
      const data = model.laidOutDataMap.get(vr.displayedRegionIndex)
      if (!data) {
        continue
      }
      renderLabels(
        ctx,
        data,
        vr.start,
        vr.end,
        vr.screenStartPx,
        vr.screenEndPx,
        vr.reversed,
      )
      if (renderPeptidesFlag) {
        renderPeptides(
          ctx,
          data,
          vr.start,
          vr.end,
          vr.screenStartPx,
          vr.screenEndPx,
          vr.reversed,
        )
      }
    }
  })

  return (
    <SvgClipRect
      id={`canvas-features-clip-${model.id}`}
      width={view.width}
      height={height}
    >
      {featuresNode}
      {textNode}
    </SvgClipRect>
  )
}
