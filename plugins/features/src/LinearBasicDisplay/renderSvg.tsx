/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import { labelColors } from './components/labelColors.ts'
import {
  exactCullBand,
  forEachDisplayLabel,
  viewportBand,
} from './components/labelPositioning.ts'
import { paintLabels } from './components/paintLabels.ts'
import { drawPeptidesForRegions } from './components/peptidePositioning.ts'
import { resolveMapColors } from './components/resolveRegionColors.ts'
import { BASIC_FEATURE_MARKS } from './marks/basicFeatureMarks.ts'

import type { FieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderState } from './components/featureRenderingBackendTypes.ts'
import type { LabelPlacementContext } from './components/labelPositioning.ts'
import type { FeatureGroupSection } from './facet.ts'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
  SvgDisplayBox,
  SvgViewFrame,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

/**
 * What the export's body reads off the display, which a static export builds
 * as a plain object off its static host.
 */
export interface FeaturesSvgBodyModel extends SvgDisplayBox {
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  fieldPalette: FieldPalette | undefined
  renderState: RenderState
  renderedLabels: LabelPlacementContext
  showsGroupLabels: boolean
  groupSections: FeatureGroupSection[]
}

/** The view frame the body reads: the shell's, and the zoom. */
export interface FeaturesSvgFrame extends SvgViewFrame {
  bpPerPx: number
}

export interface RenderSvgModel extends FeaturesSvgBodyModel, LgvSvgExportable {
  // Drawn by the shell, over this body — not here. Declared so the export's
  // model still names every guide the figure carries.
  pinnedInk: HighlightRect[]
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, FeaturesSvgBody)
}

/**
 * The exported features, labels, residues and section chips, mounted by the
 * display shell over the containing view or over a static frame.
 */
export function FeaturesSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  overlays,
  opts,
}: LgvSvgBodyProps<FeaturesSvgBodyModel, FeaturesSvgFrame>) {
  const palette = usePalette()
  const visibleRegions = view.visibleRegions
  // Anchors the chips to the content edge; non-zero only when scrolled
  // before the genome start.
  const contentLeft = Math.max(-view.offsetPx, 0)
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)
  // The screen's render state, scroll included, so a scrolled track exports
  // what is on screen.
  const { renderState } = model
  const { scrollY } = renderState
  const { fontSize } = model.renderedLabels
  const labelContext = { ...model.renderedLabels, colors: labelColors(palette) }
  const dataMap = resolveMapColors(
    model.laidOutDataMap,
    palette,
    model.fieldPalette,
  )
  const labelBand = exactCullBand(scrollY, height, fontSize)
  const peptideBand = viewportBand(scrollY, height)

  return (
    <>
      <MarkSvgLayer
        marks={BASIC_FEATURE_MARKS}
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
              labelBand,
            )
            // Peptides need no cross-region dedup, unlike labels: codons
            // straddling a boundary overstrike identically.
            if (renderPeptidesFlag) {
              drawPeptidesForRegions(
                ctx,
                model.laidOutDataMap,
                visibleRegions,
                peptideBand,
              )
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
