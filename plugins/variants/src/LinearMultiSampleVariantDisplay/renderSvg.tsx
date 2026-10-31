/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintFeatureBand } from '@jbrowse/plugin-features/band'

import { REFERENCE_COLOR } from '../shared/constants.ts'
import SvgVariantOverlay from './components/SvgVariantOverlay.tsx'
import { VARIANT_MARKS } from './components/variantMarks.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
import type { RenderSvgBaseModel } from './renderSvgUtils.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { FeatureDataResult } from '@jbrowse/plugin-features/band'

interface RenderSvgModel extends RenderSvgBaseModel {
  referenceDrawingMode: string
  renderBlocks: VariantRenderBlock[]
  perRegionCellMap: ReadonlyMap<number, VariantUploadData>
  renderState: VariantRenderState
  // the records band's kept stack, empty when it is off (`recordsFitStage`)
  recordsLaidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  recordsRenderedLabels: { showLabels: boolean; showDescriptions: boolean }
  recordsFontSize: number
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
    recordsLaidOutDataMap,
    recordsRenderedLabels,
    recordsFontSize,
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
      // the band the screen drew, through the same plugin-features call, on
      // its own untranslated layer as the screen gives it its own canvas
      records={
        topBands.recordsHeight > 0 ? (
          <PaintLayer
            width={canvasWidth}
            height={topBands.recordsHeight}
            opts={opts}
            paint={ctx => {
              paintFeatureBand(
                ctx,
                recordsLaidOutDataMap,
                renderBlocks,
                view.visibleRegions,
                {
                  canvasWidth,
                  bandHeight: topBands.recordsHeight,
                  ...recordsRenderedLabels,
                  fontSize: recordsFontSize,
                  scrollY: 0,
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
        state={{ ...renderState, snapScale: 1 }}
        width={canvasWidth}
        height={canvasHeight}
        opts={opts}
      />
    </SvgVariantOverlay>
  )
}
