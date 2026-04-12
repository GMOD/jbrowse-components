import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { SVGErrorBox } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import {
  drawArrows,
  drawLines,
  drawRects,
} from './components/Canvas2DFeatureRenderer.ts'
import { bpToScreenPx } from './components/coordinateUtils.ts'
import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderSvgModel {
  rpcDataMap: Map<number, FeatureDataResult>
  error: unknown
  regionTooLarge: boolean
  height: number
}

const LABEL_FONT_SIZE = 11

function renderLabels(
  ctx: SvgCanvas,
  data: FeatureDataResult,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
) {
  const { floatingLabelsData, regionStart: dataRegionStart } = data

  ctx.font = `${LABEL_FONT_SIZE}px sans-serif`

  for (const labelData of Object.values(floatingLabelsData)) {
    const featureStartBp = labelData.minX + dataRegionStart
    const featureEndBp = labelData.maxX + dataRegionStart

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
  ctx: SvgCanvas,
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
    const fontSize = Math.min(item.heightPx - 2, 12)
    const y = item.topPx + item.heightPx / 2 + fontSize / 3

    ctx.fillStyle = item.isStopOrNonTriplet ? 'red' : 'black'
    ctx.font = `${fontSize}px monospace`
    ctx.fillText(`${item.aminoAcid}${item.proteinIndex + 1}`, centerPx, y)
  }
  ctx.textAlign = 'start'
}

export async function renderSvg(
  model: RenderSvgModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )
  const { rpcDataMap } = model

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  if (rpcDataMap.size === 0) {
    return null
  }

  const visibleRegions = view.visibleRegions as {
    regionNumber: number
    start: number
    end: number
    reversed?: boolean
    screenStartPx: number
    screenEndPx: number
  }[]

  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)
  const svgCanvas = new SvgCanvas()

  for (const vr of visibleRegions) {
    const data = rpcDataMap.get(vr.regionNumber)
    if (!data) {
      continue
    }

    const block = {
      screenStartPx: vr.screenStartPx,
      screenEndPx: vr.screenEndPx,
      bpRangeX: [vr.start, vr.end] as [number, number],
      reversed: vr.reversed ?? false,
    }
    const bpLength = vr.end - vr.start
    const fullBlockWidth = vr.screenEndPx - vr.screenStartPx

    drawLines(svgCanvas, data, block, bpLength, fullBlockWidth, 0)
    drawRects(svgCanvas, data, block, bpLength, fullBlockWidth, 0)
    drawArrows(svgCanvas, data, block, bpLength, fullBlockWidth, 0)
    renderLabels(
      svgCanvas,
      data,
      vr.start,
      vr.end,
      vr.screenStartPx,
      vr.screenEndPx,
      vr.reversed,
    )
    if (renderPeptidesFlag) {
      renderPeptides(
        svgCanvas,
        data,
        vr.start,
        vr.end,
        vr.screenStartPx,
        vr.screenEndPx,
        vr.reversed,
      )
    }
  }

  return (
    <g dangerouslySetInnerHTML={{ __html: svgCanvas.getSerializedSvg() }} />
  )
}
