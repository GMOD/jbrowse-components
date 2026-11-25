/* eslint-disable react-refresh/only-export-components */
import { useExportFontFamily } from '@jbrowse/core/svg/constants'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { GroupLabelBoxes } from '@jbrowse/display-kit/GroupLabelBox'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import SvgVariantOverlay from './components/SvgVariantOverlay.tsx'
import { VARIANT_MARKS } from './components/variantMarks.ts'
import {
  recordsBandLayerPainters,
  recordsSectionsInBand,
} from './recordsBandPaint.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
import type { RecordsBandPaintModel } from './recordsBandPaint.ts'
import type { RenderSvgBaseModel } from './renderSvgUtils.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

interface RenderSvgModel extends RenderSvgBaseModel, RecordsBandPaintModel {
  rowBackground: string
  renderBlocks: VariantRenderBlock[]
  perRegionCellMap: ReadonlyMap<number, VariantUploadData>
  renderState: VariantRenderState
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
  const { rowBackground, renderBlocks, perRegionCellMap, renderState } = model
  const { canvasHeight } = renderState
  const recordsHeight = model.topBands.reserved.records
  const palette = usePalette()
  const fontFamily = useExportFontFamily()
  const paintRecords = recordsBandLayerPainters(model, {
    canvasWidth,
    regions: view.visibleRegions,
    palette,
    fontFamily,
  })
  return (
    <SvgVariantOverlay
      model={model}
      width={canvasWidth}
      overlays={overlays}
      text={opts}
      // the band the screen drew, through the same painters, on its own
      // untranslated layers as the screen gives it its own canvas; the labels
      // without `opts`, so they stay text over a rasterized band
      records={
        recordsHeight > 0 ? (
          <>
            <PaintLayer
              width={canvasWidth}
              height={recordsHeight}
              opts={opts}
              paint={paintRecords.glyphs}
            />
            <PaintLayer
              width={canvasWidth}
              height={recordsHeight}
              paint={paintRecords.labels}
            />
            {/* the record sections' names, the twin of the band's chips */}
            {model.recordsGroupSections.length > 0 ? (
              <GroupLabelBoxes
                sections={recordsSectionsInBand(model)}
                left={0}
                width={canvasWidth}
                canvasHeight={recordsHeight}
              />
            ) : null}
          </>
        ) : null
      }
    >
      {/* the screen's canvas background, under the cells */}
      {rowBackground ? (
        <rect width={canvasWidth} height={canvasHeight} fill={rowBackground} />
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
