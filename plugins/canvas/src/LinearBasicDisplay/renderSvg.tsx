import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SVGErrorBox,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import { drawFeatureBlocks } from './components/Canvas2DFeatureRenderer.ts'
import { forEachRenderedLabel } from './components/labelPositioning.ts'
import { forEachRenderedPeptide } from './components/peptidePositioning.ts'
import {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from './components/sharedRendererConstants.ts'
import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { SvgExportable } from '@jbrowse/core/util/svgReady'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

type LGV = LinearGenomeViewModel
type SvgRegionBounds = BpRegionBounds

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  regionTooLarge: boolean
  laidOutDataMap: Map<number, FeatureDataResult>
  showLabels: boolean
  effectiveShowDescriptions: boolean
  displayMode: string
}

// Labels and amino-acid overlays are rendered as DOM/React overlays
// on-screen, so the on-screen renderer doesn't draw them. SVG export must
// bake them into the output, so they live here as a vector-only post-pass
// that runs after drawFeatureBlocks paints the geometry.
function renderLabels(
  ctx: Ctx2D,
  data: FeatureDataResult,
  vr: SvgRegionBounds,
  visibility: { showLabels: boolean; showDescriptions: boolean },
  decimateLabels: boolean,
) {
  ctx.font = `${LABEL_FONT_SIZE}px sans-serif`
  forEachRenderedLabel(
    data,
    vr,
    visibility,
    (_, labels) => {
      for (const { label, labelX, labelY } of labels) {
        if (label.isOverlay) {
          ctx.fillStyle = LABEL_OVERLAY_BACKGROUND
          ctx.fillRect(
            labelX - 1,
            labelY,
            label.textWidth + 2,
            LABEL_FONT_SIZE + 1,
          )
        }
        ctx.fillStyle = label.color
        ctx.fillText(label.text, labelX, labelY + LABEL_FONT_SIZE)
      }
    },
    decimateLabels,
  )
}

function renderPeptides(
  ctx: Ctx2D,
  data: FeatureDataResult,
  vr: SvgRegionBounds,
) {
  ctx.textAlign = 'center'
  forEachRenderedPeptide(data, vr, (item, { centerPx, fontSize, text }) => {
    const y = item.topPx + item.heightPx / 2 + fontSize / 3
    ctx.font = `${fontSize}px monospace`
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1
    ctx.strokeText(text, centerPx, y)
    ctx.fillStyle = item.isStopOrNonTriplet ? 'red' : 'black'
    ctx.fillText(text, centerPx, y)
  })
  ctx.textAlign = 'start'
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  // svgReady waits for ALL visible regions, not just the first to stream in, so
  // whole-genome / multi-region exports aren't partially drawn.
  await awaitSvgReady(model)

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

  const renderBlocks = buildRenderBlocks(visibleRegions)
  const featuresNode = paintLayer(totalWidth, height, opts, ctx => {
    drawFeatureBlocks(ctx, model.laidOutDataMap, renderBlocks, {
      scrollY: 0,
      canvasWidth: totalWidth,
      canvasHeight: height,
    })
  })
  const visibility = {
    showLabels: model.showLabels,
    showDescriptions: model.effectiveShowDescriptions,
  }
  const decimateLabels = model.displayMode === 'collapse'
  // Labels + peptides always vector — text should remain crisp even when
  // rasterizeLayers is on.
  const textNode = paintLayer(totalWidth, height, undefined, ctx => {
    for (const vr of visibleRegions) {
      const data = model.laidOutDataMap.get(vr.displayedRegionIndex)
      if (!data) {
        continue
      }
      renderLabels(ctx, data, vr, visibility, decimateLabels)
      if (renderPeptidesFlag) {
        renderPeptides(ctx, data, vr)
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
