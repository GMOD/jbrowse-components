/* eslint-disable react-refresh/only-export-components */
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

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

interface RenderSvgModel extends RenderSvgBaseModel {
  referenceDrawingMode: string
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
  overlays,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  // the model's own block set and region map, so the export draws what the
  // live canvas does
  const { referenceDrawingMode, renderBlocks, perRegionCellMap, renderState } =
    model
  const { canvasHeight } = renderState
  return (
    <SvgVariantOverlay
      model={model}
      width={canvasWidth}
      overlays={overlays}
      text={opts}
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
