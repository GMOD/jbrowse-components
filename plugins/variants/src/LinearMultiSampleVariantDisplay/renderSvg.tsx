/* eslint-disable react-refresh/only-export-components */
import { paintInsertionLabels } from '@jbrowse/alignments-core'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintFeatureBand } from '@jbrowse/plugin-canvas'

import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'
import {
  VARIANT_MARKS,
  variantInsertionParams,
} from './components/variantMarks.ts'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { FeatureDataResult } from '@jbrowse/plugin-canvas'

interface RenderSvgModel extends RenderSvgBaseModel {
  referenceDrawingMode: string
  renderBlocks: VariantRenderBlock[]
  perRegionCellMap: ReadonlyMap<number, VariantUploadData>
  renderState: VariantRenderState
  // undefined when no insertion marker draws in this window
  insertionGlyphRegions: ReadonlyMap<number, VariantUploadData> | undefined
  // The lane's laid-out band, empty when it is off. plugin-canvas's own render
  // data — see `laneFitStage`.
  laneLaidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  laneRenderedLabels: { showLabels: boolean; showDescriptions: boolean }
  laneFontSize: number
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, VariantSvgBody)
}

function VariantSvgBody({
  model,
  view,
  overlays,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  // the model's own block set and region map, so the export draws what the
  // live canvas does
  const {
    referenceDrawingMode,
    renderBlocks,
    perRegionCellMap,
    renderState,
    insertionGlyphRegions,
    laneLaidOutDataMap,
    laneRenderedLabels,
    laneFontSize,
    topBands,
  } = model
  const { canvasHeight } = renderState
  const palette = usePalette()
  return (
    <SvgVariantOverlay
      model={model}
      width={canvasWidth}
      overlays={overlays}
      text={opts}
      // Its own paint layer in the band above the rows, untranslated — the
      // same split the screen takes (a separate canvas outside the offset
      // container), so the lane cannot pick up the rows' scroll.
      variantLane={
        topBands.laneHeight > 0 ? (
          <PaintLayer
            width={canvasWidth}
            height={topBands.laneHeight}
            opts={opts}
            paint={ctx => {
              // The band the screen drew: the same laid-out stack through the
              // same plugin-canvas call, so an export cannot pack, letter or
              // order the marks differently from what the reader saw.
              paintFeatureBand(
                ctx,
                laneLaidOutDataMap,
                renderBlocks,
                view.visibleRegions,
                {
                  canvasWidth,
                  bandHeight: topBands.laneHeight,
                  ...laneRenderedLabels,
                  fontSize: laneFontSize,
                  palette,
                },
              )
            }}
          />
        ) : null
      }
    >
      {/* the screen's canvas background, under the cells */}
      {referenceDrawingMode === 'skip' ? (
        <rect
          width={canvasWidth}
          height={canvasHeight}
          fill={REFERENCE_COLOR}
        />
      ) : null}
      <MarkSvgLayer
        marks={VARIANT_MARKS}
        regions={perRegionCellMap}
        blocks={renderBlocks}
        state={renderState}
        width={canvasWidth}
        height={canvasHeight}
        opts={opts}
        paint={(ctx, state) => {
          if (overlays && insertionGlyphRegions) {
            paintInsertionLabels(
              ctx,
              renderBlocks,
              block =>
                insertionGlyphRegions.get(block.displayedRegionIndex)
                  ?.insertions,
              state,
              variantInsertionParams(state),
            )
          }
        }}
      />
    </SvgVariantOverlay>
  )
}
