import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { SvgColorLegend } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import { drawDensityBand } from '../shared/densityBand.ts'
import { densityBandReadout } from '../shared/densityBandViews.ts'
import {
  drawFeatureBlocks,
  drawHighlightBoxes,
} from './components/Canvas2DFeatureRenderer.ts'
import { highlightBoxColors } from './components/highlightUtils.ts'
import { labelColors } from './components/labelColors.ts'
import {
  LABEL_CULL_BUCKET_PX,
  forEachDisplayLabel,
  labelCullBand,
} from './components/labelPositioning.ts'
import { paintLabels } from './components/paintLabels.ts'
import { drawPeptidesForRegions } from './components/peptidePositioning.ts'
import { resolveMapColors } from './components/resolveRegionColors.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { DensityBandLayer } from '../shared/densityBand.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  scrollTop: number
  regionTooLarge: boolean
  // `renderDisplaySvg`'s hook: the band is drawn in the too-large terminal, so
  // the note that would replace this whole body must not
  drawsWhenTooLarge: boolean
  densityBandActive: boolean
  densityBandLayer: DensityBandLayer
  densityBins: ReadonlyMap<number, FeatureDensity>
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  highlightedFeatureIdSet: ReadonlySet<string>
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  // off only while a fit squeeze is scaling the rows these labels were reserved
  // in — see the model getter
  renderedShowSubfeatureLabels: boolean
  labelFontSize: number
  colorLegend: LegendItem[]
  showLegend: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // renderDisplaySvg's awaitSvgReady waits for ALL visible regions, not just the
  // first to stream in, so whole-genome / multi-region exports aren't partially
  // drawn.
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
  // The JBrowse palette, not Material UI's `useTheme`, for the same reason the
  // on-screen `overlayBoxStyles` reads it: `highlight` is a JBrowse entry a bare
  // Material theme doesn't have. `wrapSvgExport` mounts both providers from the
  // export theme, so this is still the theme the user picked in the dialog.
  const palette = usePalette()
  const visibleRegions = view.visibleRegions
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)

  // autoHeight defaults off, so a feature track is a fixed-height viewport with
  // vertical overflow the user scrolls. On-screen `renderState.scrollY` is
  // `self.scrollTop`; the export honors the same offset so a scrolled track
  // exports what's on screen (top viewport) rather than always the track top.
  const scrollY = model.scrollTop
  // Shared by the geometry pass and the highlight pass, so the boxes can't be
  // scissored against a different canvas than the glyphs they wrap.
  const renderState = { scrollY, canvasWidth, canvasHeight: height }
  const fontSize = model.labelFontSize
  const colorLegend = model.colorLegend
  // One label context for both consumers: the highlight boxes reserve exactly
  // the label width the label pass then paints.
  const labelContext = {
    showLabels: model.renderedShowLabels,
    showDescriptions: model.renderedShowDescriptions,
    showSubfeatureLabels: model.renderedShowSubfeatureLabels,
    fontSize,
    colors: labelColors(palette),
  }
  // The theme classes the worker emitted, resolved against the EXPORT theme's
  // palette rather than the session's — the whole reason the colors ride as
  // classes (see resolveRegionColors).
  const dataMap = resolveMapColors(model.laidOutDataMap, palette)
  // The export clips to the scrolled viewport (SvgClipRect below, `scrollY`
  // above), so a label whose feature sits outside it is written into the file
  // and then clipped away — on a fixed-height track scrolling over content many
  // times its height, that is most of them. Culled with the DOM overlay's own
  // band rather than a tighter export-only one: it is the band that ships on
  // screen, so the export emits exactly the labels the user is looking at.
  const cullBand = labelCullBand(
    Math.floor(scrollY / LABEL_CULL_BUCKET_PX),
    height,
  )

  return (
    <SvgClipRect
      id={`canvas-features-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      {model.densityBandActive ? (
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawDensityBand(ctx, renderBlocks, model.densityBandLayer, {
              canvasWidth,
              bandHeight: height,
              color: palette.text.secondary,
              readout: densityBandReadout(
                model.densityBandLayer,
                model.densityBins,
                undefined,
              ),
            })
          }}
        />
      ) : null}
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          drawFeatureBlocks(ctx, dataMap, renderBlocks, renderState)
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
          // Same highlight.main border/tint as the on-screen searchHighlightBox.
          drawHighlightBoxes(
            ctx,
            model.laidOutDataMap,
            renderBlocks,
            model.highlightedFeatureIdSet,
            renderState,
            highlightBoxColors(palette.highlight.main),
            labelContext,
          )
          // Labels/peptides are laid out in absolute track px (drawHighlightBoxes
          // above applies scrollY itself, as drawFeatureBlocks does); shift the
          // rest of the layer up by scrollY so text tracks the feature geometry
          // when scrolled.
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
      {/* The same color key the display shows on screen (the `colorLegend` hook —
          variants' consequence-impact / SV-type presets; absent for a plain
          feature track). Without it an exported figure has colored glyphs and
          nothing saying what the colors mean. Vector, via the shared
          SvgColorLegend the multi-row painting export already uses; no
          `onDismiss`, since an exported legend can't be clicked. Skipped when
          the user has put the key away on screen, so the export matches what
          they were looking at. */}
      {model.showLegend && colorLegend.length > 0 ? (
        <SvgColorLegend
          canvasWidth={canvasWidth}
          maxHeight={height}
          testid="canvas-color-legend"
          entries={colorLegend.map(item => ({
            key: item.label,
            label: item.label,
            color: item.color,
          }))}
        />
      ) : null}
    </SvgClipRect>
  )
}
