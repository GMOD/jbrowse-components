/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import { drawDensityBand } from '../shared/densityBand.ts'
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

import type { FieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { DensityBandLayer } from '../shared/densityBand.ts'
import type { RenderState } from './components/canvasFeatureRenderingBackendTypes.ts'
import type { FeatureGroupSection } from './facet.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export interface RenderSvgModel extends LgvSvgExportable {
  // The density band draws in the too-large state, so the too-large note must
  // not replace this body.
  drawsWhenTooLarge: boolean
  coarseTierStandsIn: boolean
  densityBandLayer: DensityBandLayer
  densityPeakReadout: string
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  fieldPalette: FieldPalette | undefined
  renderStateIn: (palette: JBrowsePalette) => RenderState
  // Drawn by the shell, over this body — not here. Declared so the export's
  // model still names every guide the figure carries.
  pinnedInk: HighlightRect[]
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  renderedShowSubfeatureLabels: boolean
  renderedLabelFontSize: number
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, CanvasFeaturesSvgBody)
}

function CanvasFeaturesSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  overlays,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  const palette = usePalette()
  const visibleRegions = view.visibleRegions
  // Anchors the chips to the content edge; non-zero only when scrolled
  // before the genome start.
  const contentLeft = Math.max(-view.offsetPx, 0)
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)
  // The screen's render state, scroll included, so a scrolled track exports
  // what is on screen.
  const renderState = model.renderStateIn(palette)
  const { scrollY } = renderState
  const fontSize = model.renderedLabelFontSize
  const labelContext = {
    showLabels: model.renderedShowLabels,
    showDescriptions: model.renderedShowDescriptions,
    showSubfeatureLabels: model.renderedShowSubfeatureLabels,
    fontSize,
    colors: labelColors(palette),
  }
  const dataMap = resolveMapColors(
    model.laidOutDataMap,
    palette,
    model.fieldPalette,
  )
  // Culled with the DOM overlay's own band so the export emits exactly the
  // labels on screen; anything outside the clip would be written and then
  // clipped away.
  const cullBand = labelCullBand(labelScrollBucket(scrollY), height)

  return (
    <>
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
      <MarkSvgLayer
        marks={CANVAS_FEATURE_MARKS}
        regions={dataMap}
        blocks={renderBlocks}
        state={renderState}
        width={canvasWidth}
        height={height}
        opts={opts}
      />
      {/* The two overlays the app canvas never paints — the floating labels (a
        DOM layer on screen) and the peptide letters (their own canvas) — baked
        in here in the on-screen stacking order, peptides over labels. One layer
        rather than two because the order within a layer already gives that, and
        because `opts` is deliberately withheld: both stay vector even when
        `rasterizeLayers` is on, so exported text stays crisp. The pinned
        highlight is no longer here: `renderDisplaySvg` draws it off `pinnedInk`,
        over this layer, as the chrome draws it over the labels on screen. */}
      {overlays ? (
        <PaintLayer
          width={canvasWidth}
          height={height}
          paint={ctx => {
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
      ) : null}
      {/* Last, so a section's name sits over the rows it labels, the twin of
        the on-screen GroupLabelsLayer. */}
      {overlays && model.showsGroupLabels ? (
        <GroupLabelBoxes
          sections={model.groupSections.map(section => ({
            ...section,
            top: section.top - scrollY,
          }))}
          left={contentLeft}
          width={canvasWidth}
          canvasHeight={height}
        />
      ) : null}
    </>
  )
}
