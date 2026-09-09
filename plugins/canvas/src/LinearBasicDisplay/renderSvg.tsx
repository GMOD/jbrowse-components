import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import { drawDensityBand } from '../shared/densityBand.ts'
import { drawHighlightBoxes } from './components/highlightBoxes.ts'
import { highlightBoxColors } from './components/highlightUtils.ts'
import { labelColors } from './components/labelColors.ts'
import {
  forEachDisplayLabel,
  labelCullBand,
  labelScrollBucket,
} from './components/labelPositioning.ts'
import { paintLabels } from './components/paintLabels.ts'
import { drawPeptidesForRegions } from './components/peptidePositioning.ts'
import { resolveMapColors } from './components/resolveRegionColors.ts'
import { CANVAS_FEATURE_MARKS } from './marks/canvasFeatureMarks.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { DensityBandLayer } from '../shared/densityBand.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  scrollTop: number
  regionTooLarge: boolean
  // The density band draws in the too-large state, so the too-large note must
  // not replace this body.
  drawsWhenTooLarge: boolean
  coarseTierStandsIn: boolean
  densityBandLayer: DensityBandLayer
  densityPeakReadout: string
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  highlightedFeatureIdSet: ReadonlySet<string>
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  renderedShowSubfeatureLabels: boolean
  labelFontSize: number
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // `awaitSvgReady` waits for every visible region, so a multi-region export
  // is not partially drawn.
  return renderDisplaySvg(model, opts, CanvasFeaturesSvgBody)
}

function CanvasFeaturesSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  // The JBrowse palette, not MUI's `useTheme`: `highlight` is a JBrowse entry
  // a bare Material theme lacks.
  const palette = usePalette()
  const visibleRegions = view.visibleRegions
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)

  // The export honours `scrollTop`, so a scrolled track exports what is on
  // screen.
  const scrollY = model.scrollTop
  // Shared by the geometry pass and the highlight pass, so the boxes are
  // scissored against the same canvas as the glyphs.
  const renderState = { scrollY, canvasWidth, canvasHeight: height }
  const fontSize = model.labelFontSize
  const labelContext = {
    showLabels: model.renderedShowLabels,
    showDescriptions: model.renderedShowDescriptions,
    showSubfeatureLabels: model.renderedShowSubfeatureLabels,
    fontSize,
    colors: labelColors(palette),
  }
  // Resolved against the export theme's palette, not the session's, which is
  // why the colors ride as classes.
  const dataMap = resolveMapColors(model.laidOutDataMap, palette)
  // Culled with the DOM overlay's own band so the export emits exactly the
  // labels on screen; anything outside the clip would be written and then
  // clipped away.
  const cullBand = labelCullBand(labelScrollBucket(scrollY), height)

  return (
    <SvgClipRect
      id={`canvas-features-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      {model.coarseTierStandsIn ? (
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawDensityBand(ctx, renderBlocks, model.densityBandLayer, {
              canvasWidth,
              bandHeight: height,
              readout: model.densityPeakReadout,
              palette,
            })
          }}
        />
      ) : null}
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          paintMarkBlocks(
            ctx,
            CANVAS_FEATURE_MARKS,
            dataMap,
            renderBlocks,
            renderState,
          )
        }}
      />
      {/* The three overlays the app canvas never paints — on-screen they are the
          highlight boxes (a DOM layer), the floating labels (another) and the
          peptide letters (their own canvas) — baked in here in the on-screen
          stacking order: boxes over the glyphs, labels over the boxes, peptides
          over both. One layer rather than three because the order within a
          layer already gives that, and because `opts` is deliberately withheld:
          all three stay vector even when `rasterizeLayers` is on, so exported
          text and box edges remain crisp. */}
      <PaintLayer
        width={canvasWidth}
        height={height}
        paint={ctx => {
          drawHighlightBoxes(
            ctx,
            model.laidOutDataMap,
            renderBlocks,
            model.highlightedFeatureIdSet,
            renderState,
            highlightBoxColors(palette.highlight.main),
            labelContext,
          )
          // Labels and peptides are laid out in absolute track px, so the
          // layer shifts up by scrollY.
          ctx.translate(0, -scrollY)
          forEachDisplayLabel(
            visibleRegions,
            model.laidOutDataMap,
            labelContext,
            (_, labels) => {
              paintLabels(ctx, labels, fontSize)
            },
            cullBand,
          )
          // Peptides need no cross-region dedup, unlike labels: codons
          // straddling a boundary overstrike identically.
          if (renderPeptidesFlag) {
            drawPeptidesForRegions(ctx, model.laidOutDataMap, visibleRegions)
          }
        }}
      />
    </SvgClipRect>
  )
}
