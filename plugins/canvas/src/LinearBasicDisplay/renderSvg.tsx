/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { useTheme } from '@mui/material'

import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import {
  drawFeatureBlocks,
  drawHighlightBoxes,
} from './components/Canvas2DFeatureRenderer.ts'
import { highlightBoxColors } from './components/highlightUtils.ts'
import { forEachDisplayLabel } from './components/labelPositioning.ts'
import { drawPeptidesForRegions } from './components/peptidePositioning.ts'
import { LABEL_OVERLAY_BACKGROUND } from './components/sharedRendererConstants.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ResolvedLabel } from './components/labelPositioning.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  scrollTop: number
  regionTooLarge: boolean
  laidOutDataMap: Map<number, FeatureDataResult>
  highlightedFeatureIdSet: ReadonlySet<string>
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  labelFontSize: number
}

// Labels and amino-acid overlays are rendered as DOM/React overlays
// on-screen, so the on-screen renderer doesn't draw them. SVG export must
// bake them into the output, so they live here as a vector-only post-pass
// that runs after drawFeatureBlocks paints the geometry.
function paintLabel(ctx: Ctx2D, labels: ResolvedLabel[], fontSize: number) {
  for (const { label, labelX, labelY } of labels) {
    if (label.isOverlay) {
      ctx.fillStyle = LABEL_OVERLAY_BACKGROUND
      ctx.fillRect(labelX - 1, labelY, label.textWidth + 2, fontSize + 1)
    }
    ctx.fillStyle = label.color
    ctx.fillText(label.text, labelX, labelY + fontSize)
  }
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // svgReady waits for ALL visible regions, not just the first to stream in, so
  // whole-genome / multi-region exports aren't partially drawn.
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <CanvasFeaturesSvgBody
        model={model}
        view={view}
        height={height}
        opts={opts}
      />
    </SvgChrome>
  )
}

function CanvasFeaturesSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: RenderSvgModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  const theme = useTheme()
  const visibleRegions = view.visibleRegions
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width

  // autoHeight defaults off, so a feature track is a fixed-height viewport with
  // vertical overflow the user scrolls. On-screen `renderState.scrollY` is
  // `self.scrollTop`; the export honors the same offset so a scrolled track
  // exports what's on screen (top viewport) rather than always the track top.
  const scrollY = model.scrollTop
  const renderBlocks = buildRenderBlocks(visibleRegions)
  const highlightColor = theme.palette.highlight.main
  const fontSize = model.labelFontSize
  const context = {
    showLabels: model.renderedShowLabels,
    showDescriptions: model.renderedShowDescriptions,
    fontSize,
  }

  return (
    <SvgClipRect
      id={`canvas-features-clip-${model.id}`}
      width={view.width}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          drawFeatureBlocks(ctx, model.laidOutDataMap, renderBlocks, {
            scrollY,
            canvasWidth,
            canvasHeight: height,
          })
        }}
      />
      {/* Highlight boxes are on-screen DOM overlays the app canvas never paints,
          so bake them in here (same highlight.main border/tint as
          searchHighlightBox). Drawn over the features but under labels, matching
          the on-screen layering. */}
      <PaintLayer
        width={canvasWidth}
        height={height}
        paint={ctx => {
          drawHighlightBoxes(
            ctx,
            model.laidOutDataMap,
            renderBlocks,
            model.highlightedFeatureIdSet,
            { scrollY, canvasWidth, canvasHeight: height },
            highlightBoxColors(highlightColor),
            {
              showLabels: model.renderedShowLabels,
              showDescriptions: model.renderedShowDescriptions,
            },
          )
        }}
      />
      {/* Labels + peptides always vector — text should remain crisp even when
          rasterizeLayers is on. */}
      <PaintLayer
        width={canvasWidth}
        height={height}
        paint={ctx => {
          ctx.font = `${fontSize}px sans-serif`
          // Labels/peptides are laid out in absolute track px (no per-layer
          // scrollY, unlike drawFeatureBlocks); shift the whole layer up by
          // scrollY so text tracks the feature geometry when scrolled.
          ctx.translate(0, -scrollY)
          forEachDisplayLabel(
            visibleRegions,
            model.laidOutDataMap,
            context,
            (_, labels) => {
              paintLabel(ctx, labels, fontSize)
            },
          )
          // Same peptide walk the app canvas runs (drawPeptidesForRegions), so
          // the export can't drift from on-screen. Peptides need no cross-region
          // dedup, unlike labels above: codons straddling a boundary overstrike
          // identically rather than doubling; labels differ only because
          // computeLabelPosition clamps X per region.
          if (renderPeptidesFlag) {
            drawPeptidesForRegions(ctx, model.laidOutDataMap, visibleRegions)
          }
        }}
      />
    </SvgClipRect>
  )
}
