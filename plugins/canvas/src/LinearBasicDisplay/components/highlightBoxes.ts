import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { computeOverlayRect, overlayItemRect } from './highlightUtils.ts'
import { computeLabelExtraWidth } from './labelPositioning.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  HitItemBase,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

interface HighlightLabelContext {
  showLabels: boolean
  showDescriptions: boolean
  fontSize: number
}

function drawHighlightBox(
  ctx: Ctx2D,
  item: HitItemBase,
  block: BpRegionBounds,
  toX: (bp: number) => number,
  scrollY: number,
  colors: { border: string; fill: string },
  labelData: FeatureLabelData | undefined,
  labelContext: HighlightLabelContext,
) {
  const rect = overlayItemRect(item, block)
  if (rect) {
    // The box wraps the glyph and its label, measured off the feature's full
    // width rather than the clamped rect.
    const extraWidth = labelData
      ? computeLabelExtraWidth(
          labelData,
          Math.abs(toX(item.endBp) - toX(item.startBp)),
          labelContext.showLabels,
          labelContext.showDescriptions,
          labelContext.fontSize,
        )
      : 0
    // The scroll offset below is what ScrollLockedOverlay applies on screen
    // through its -scrollTop transform.
    const box = computeOverlayRect(rect, extraWidth, 2, 2)
    const top = box.top - scrollY
    ctx.fillStyle = colors.fill
    ctx.fillRect(box.left, top, box.width, box.height)
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.strokeRect(box.left, top, box.width, box.height)
  }
}

// The search highlight is the only on-screen overlay kind the export draws:
// hover, the in-progress solo collection and the selection box are live-session
// UI, and a feature left selected from a details widget would border every
// export. The resolved id set holds a top-level feature or its subfeature, never
// both, so scanning both arrays cannot double-box.
export function drawHighlightBoxes(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, FeatureDataResult>,
  blocks: FeatureRenderBlock[],
  highlightedIds: ReadonlySet<string>,
  state: RenderState,
  colors: { border: string; fill: string },
  labelContext: HighlightLabelContext,
) {
  const { canvasWidth, canvasHeight, scrollY } = state
  if (highlightedIds.size === 0) {
    return
  }
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block) => {
      const toX = makeBpMapper(block)
      for (const item of region.flatbushItems) {
        if (highlightedIds.has(item.featureId)) {
          drawHighlightBox(
            ctx,
            item,
            block,
            toX,
            scrollY,
            colors,
            region.floatingLabelsData.get(item.featureId),
            labelContext,
          )
        }
      }
      for (const item of region.subfeatureInfos) {
        if (highlightedIds.has(item.featureId)) {
          drawHighlightBox(
            ctx,
            item,
            block,
            toX,
            scrollY,
            colors,
            undefined,
            labelContext,
          )
        }
      }
    },
  )
}
