import { Fragment, useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import {
  BAND_SEAM_HIT_PX,
  BandSeamHandle,
} from '@jbrowse/display-kit/BandSeamHandle'
import { groupSectionLabel } from '@jbrowse/display-kit/groupLabelStyle'
import { observer } from 'mobx-react'

import {
  LANE_BAND_ORDER,
  laneBandBottom,
  stackedBandGain,
} from '../sectionLayout.ts'
import ArcHoverOverlay from './ArcHoverOverlay.tsx'
import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'
import PileupTruncationRule from './PileupTruncationRule.tsx'
import SashimiLabelsOverlay from './SashimiLabelsOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { bandScreenTop, contentScreenY, sectionKey } from './sectionScreen.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LaneBandKey } from '../sectionLayout.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type React from 'react'

// The pileup canvas + all its positioned overlays. DisplayChrome owns the GPU
// backend and the three terminal states (render error, region-too-large, fetch
// error + loading), so this body renders only the success path — it receives
// the live `canvas`/`canvasRef` and never has to gate on them.
const PileupBody = observer(function PileupBody({
  model,
  canvasRef,
}: {
  model: LinearAlignmentsDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const {
    width,
    handleMouseLeave,
    handleMouseDown,
    handleContextMenu,
    handleCanvasMouseMove,
    handleClick,
  } = useAlignmentsBase(model)

  const canvasId = useId()
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)

  usePanelVirtualScroll(panel, model, model.view.scrollZoom)

  if (!width) {
    return null
  }

  const { height, stickyBandHeight } = model

  return (
    <div
      // No testid: `pileup-display[-done]` is DisplayChrome's now, on the same
      // element as `data-display-phase`. This div stays for its layout role (it
      // sizes the pileup below the sticky coverage band), not as a query target
      // — and, since it wraps the canvas together with every overlay drawn over
      // it, as the element the wheel gesture above binds to.
      ref={setPanel}
      style={{ position: 'relative', width: '100%', height }}
    >
      <PileupCanvas
        model={model}
        canvasId={canvasId}
        canvasRef={canvasRef}
        width={width}
        height={height}
        handleCanvasMouseMove={handleCanvasMouseMove}
        handleMouseLeave={handleMouseLeave}
        handleMouseDown={handleMouseDown}
        handleClick={handleClick}
        handleContextMenu={handleContextMenu}
      />

      <GroupLabelsOverlay model={model} />
      <PileupTruncationRule model={model} />

      <SashimiLabelsOverlay model={model} />
      <ArcHoverOverlay model={model} />

      <VisibleLabelsHost model={model} width={width} height={height} />

      <LaneBandResizeHandles model={model} />

      <GroupResizeHandles model={model} />

      {/* the pileup's own viewport, so in ungrouped mode it starts below the
          pinned coverage band rather than fading the band itself */}
      <ScrollChrome
        model={model}
        controlsId={canvasId}
        top={stickyBandHeight}
      />
    </div>
  )
})

// Shared horizontal drag handle for the pileup's resizable bands. Callers pass
// the screen-space `seam` and the canvas height; the strip is the shared
// `BandSeamHandle`, and the off-screen cull and the `value`/`onChange` contract
// are uniform across coverage, arc/sashimi, and group handles.
//
// `gain` (see `useResizeDrag`) is what keeps a handle on a DISPLAY-GLOBAL band
// under the pointer: growing the coverage height grows the bands of the groups
// ABOVE it too, so the second group's handle used to travel at twice the
// pointer's speed and slide out from under the cursor mid-drag. Every caller
// below states how many copies of its band sit at or above the handle.
export const PileupResizeHandle = observer(function PileupResizeHandle({
  seam,
  canvasHeight,
  value,
  onChange,
  title,
  gain,
}: {
  seam: number
  canvasHeight: number
  value: number
  onChange: (height: number) => void
  title: string
  gain?: number
}) {
  // the handle being dragged stays mounted when its seam leaves the canvas:
  // unmounting it releases the pointer and ends the drag with no pointerup
  const [dragging, setDragging] = useState(false)
  const offCanvas = seam < 0 || seam - BAND_SEAM_HIT_PX > canvasHeight
  return offCanvas && !dragging ? null : (
    <BandSeamHandle
      seam={seam}
      gain={gain}
      value={value}
      onChange={height => {
        onChange(height)
      }}
      onDragStart={() => {
        setDragging(true)
      }}
      onDragEnd={() => {
        setDragging(false)
      }}
      title={title}
    />
  )
})

const BAND_NAMES: Record<LaneBandKey, string> = {
  coverage: 'coverage',
  readConnections: 'read connections',
  sashimi: 'sashimi',
}

const SET_BAND_HEIGHT: Record<
  LaneBandKey,
  (model: LinearAlignmentsDisplayModel, height: number) => void
> = {
  coverage: (model, height) => {
    model.setCoverageHeight(height)
  },
  readConnections: (model, height) => {
    model.setReadConnectionsHeight(height)
  },
  sashimi: (model, height) => {
    model.setSashimiHeight(height)
  },
}

// A resize handle at the bottom seam of every band each section reserves, in
// the stack's own order. A band height is display-global, so every handle for
// a band resizes it in every section, and grouped mode still gets one
// affordance per group, scrolling with its section and culled off-screen;
// ungrouped is the single sticky section.
//
// Gated per section on the px the band reserves: a lane that reserves no strip
// has none to resize, and its handle would land on the pixel of the one above
// it. The same count gears each handle, since the Nth band of a kind sits
// below N of them and moves N px per px of height, while a lane without one
// passes the drag straight through. The title says the drag is display-wide,
// since the bands the user is NOT pointing at move too.
export const LaneBandResizeHandles = observer(function LaneBandResizeHandles({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { height, scrollModel: scroll, isGrouped, renderSections } = model
  const scope = isGrouped ? ' of every group' : ''
  return (
    <>
      {renderSections.map((section, i) => (
        <Fragment key={sectionKey(section.groupKey)}>
          {LANE_BAND_ORDER.map(key =>
            section.bands.reserved[key] > 0 ? (
              <PileupResizeHandle
                key={key}
                seam={bandScreenTop(laneBandBottom(section, key), scroll)}
                canvasHeight={height}
                gain={stackedBandGain(renderSections, i, key)}
                value={section.bands.height[key]}
                onChange={h => {
                  SET_BAND_HEIGHT[key](model, h)
                }}
                title={`Drag to resize the ${BAND_NAMES[key]} band${scope}`}
              />
            ) : null,
          )}
        </Fragment>
      ))}
    </>
  )
})

// Per-group pileup-height drag handles (in-track grouping only). Each sits at a
// non-collapsed section's bottom edge, below any room it reserves for a
// dipping connector or its label chip, and resizes just that group's band, so
// a dense section can be shrunk without touching the others.
const GroupResizeHandles = observer(function GroupResizeHandles({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  // `canSizeGroupHeights` is the shared gate with the label chip's expand
  // button — both set a lane's own cap, so neither is offered where the other
  // is hidden. Only stacked lanes get a drag: one section's pileup
  // bottom is the display's own bottom edge, which the track height owns.
  if (!model.isGrouped || !model.canSizeGroupHeights) {
    return null
  }
  const { height, scrollModel: scroll } = model
  return (
    <>
      {model.renderSections.map(section => {
        if (section.collapsed) {
          return null
        }
        const sectionBottom = section.coverageTop + section.height
        const bottom = contentScreenY(sectionBottom, scroll)
        // from the height the lane was given, which can sit between two row
        // boundaries or past its rows, rather than the row-snapped band it
        // shows, so a drag inside one row does not snap back to it. An unsized
        // lane starts from the seam's own height, label floor included: a
        // sized lane is the height it was given, so starting from the band
        // alone dropped that on the first frame.
        const given = model.groupSizes.get(section.groupKey)
        return (
          <PileupResizeHandle
            key={sectionKey(section.groupKey)}
            // The strip overhangs the seam, which here DRAWS a line
            // (`GroupLabelsOverlay`'s divider, at the next section's top): a
            // strip ending above it left the visible line the one place the
            // pointer got no answer.
            seam={bottom}
            canvasHeight={height}
            value={
              typeof given === 'number'
                ? given
                : sectionBottom - section.pileupTop
            }
            onChange={h => {
              model.setGroupHeight(section.groupKey, h)
            }}
            title={`Drag to resize "${groupSectionLabel(section.label)}"`}
          />
        )
      })}
    </>
  )
})

const PileupCanvas = observer(function PileupCanvas({
  model,
  canvasId,
  canvasRef,
  width,
  height,
  handleCanvasMouseMove,
  handleMouseLeave,
  handleMouseDown,
  handleClick,
  handleContextMenu,
}: {
  model: LinearAlignmentsDisplayModel
  canvasId: string
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  height: number
  handleCanvasMouseMove: (e: React.MouseEvent) => void
  handleMouseLeave: () => void
  handleMouseDown: () => void
  handleClick: (e: React.MouseEvent) => void
  handleContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <canvas
      id={canvasId}
      role="img"
      aria-label={`Sequence alignments pileup of ${model.featureNoun}s`}
      ref={canvasRef}
      style={{
        display: 'block',
        width,
        height,
        cursor:
          model.featureIdUnderMouse || model.overCigarItem
            ? 'pointer'
            : 'default',
      }}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  )
})

const VisibleLabelsHost = observer(function VisibleLabelsHost({
  model,
  width,
  height,
}: {
  model: LinearAlignmentsDisplayModel
  width: number
  height: number
}) {
  return (
    <VisibleLabelsOverlay
      labels={model.visibleLabels}
      width={width}
      height={height}
      baseColors={{
        colors: model.themed.colors,
        basesField: model.baseLayer?.field,
      }}
    />
  )
})

export default PileupBody
