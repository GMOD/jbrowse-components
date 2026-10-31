import { Fragment, useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import {
  BAND_SEAM_HIT_PX,
  BandSeamHandle,
} from '@jbrowse/display-kit/BandSeamHandle'
import { groupSectionLabel } from '@jbrowse/display-kit/groupLabelStyle'
import { observer } from 'mobx-react'

import { stackedBandGain } from '../sectionLayout.ts'
import ArcHoverOverlay from './ArcHoverOverlay.tsx'
import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'
import PileupTruncationRule from './PileupTruncationRule.tsx'
import SashimiLabelsOverlay from './SashimiLabelsOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { bandScreenTop, contentScreenY, sectionKey } from './sectionScreen.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

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

      <CoverageResizeHandle model={model} />

      <ConnectionBandResizeHandles model={model} />

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
// `BandSeamHandle`, and the off-screen cull and the void-returning `onDrag`
// contract are uniform across coverage, arc/sashimi, and group handles.
//
// `gain` (see `useResizeDrag`) is what keeps a handle on a DISPLAY-GLOBAL band
// under the pointer: growing the coverage height grows the bands of the groups
// ABOVE it too, so the second group's handle used to travel at twice the
// pointer's speed and slide out from under the cursor mid-drag. Every caller
// below states how many copies of its band sit at or above the handle.
const PileupResizeHandle = observer(function PileupResizeHandle({
  seam,
  canvasHeight,
  onDrag,
  title,
  gain,
}: {
  seam: number
  canvasHeight: number
  onDrag: (dy: number) => void
  title: string
  gain?: number
}) {
  if (seam < 0 || seam - BAND_SEAM_HIT_PX > canvasHeight) {
    return null
  }
  return (
    <BandSeamHandle
      seam={seam}
      gain={gain}
      onDrag={dy => {
        onDrag(dy)
      }}
      title={title}
    />
  )
})

// Coverage-band resize handle at each section's coverage bottom. `coverageHeight`
// is display-global, so every handle resizes all bands together; grouped mode
// still gets one affordance per group (each section keeps its own coverage band,
// including collapsed groups), scrolling with its band. Ungrouped is the single
// sticky section, reproducing the prior lone handle at `coverageHeight`.
//
// Every section carries a coverage band, so the handle on the Nth one sits below
// N of them and moves N px per px of height — its `gain`. The title says the
// drag is display-wide, since the bands the user is NOT pointing at move too.
const CoverageResizeHandle = observer(function CoverageResizeHandle({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  if (!model.showCoverage) {
    return null
  }
  const { height, scrollModel: scroll, isGrouped } = model
  return (
    <>
      {model.renderSections.map((section, i) => {
        const bottom = bandScreenTop(
          section.coverageTop + section.coverageHeight,
          scroll,
        )
        return (
          <PileupResizeHandle
            key={sectionKey(section.groupKey)}
            seam={bottom}
            canvasHeight={height}
            gain={i + 1}
            onDrag={dy => {
              model.setCoverageHeight(model.coverageHeight + dy)
            }}
            title={
              isGrouped
                ? 'Drag to resize the coverage track of every group'
                : 'Drag to resize coverage track'
            }
          />
        )
      })}
    </>
  )
})

// Arc + sashimi band resize handles, one per group. The heights are
// display-global, so every handle resizes all sections' bands together; each
// still gets an affordance at its own band bottom (arc band ends at the sashimi
// band top; the sashimi band ends at the pileup top), scrolling with its
// section and culled off-screen. Ungrouped is the single sticky section.
//
// Both handles are gated per section (`hasArcsBand` / `hasSashimiBand`), not on
// the global geometry: a lane that reserves no strip has none to resize, and its
// handle would land on the pixel of the handle above it.
//
// Which is also why their `gain` counts the strips actually reserved above each
// handle rather than the sections: an arc-less lane passes the drag straight
// through, so it moves nothing the handle below it stacks on.
const ConnectionBandResizeHandles = observer(
  function ConnectionBandResizeHandles({
    model,
  }: {
    model: LinearAlignmentsDisplayModel
  }) {
    const { height, scrollModel: scroll, renderSections } = model
    const scope = model.isGrouped ? ' of every group' : ''
    return (
      <>
        {renderSections.map((section, i) => {
          return (
            <Fragment key={sectionKey(section.groupKey)}>
              {section.hasArcsBand ? (
                <PileupResizeHandle
                  seam={bandScreenTop(section.sashimiBandTop, scroll)}
                  canvasHeight={height}
                  gain={stackedBandGain(renderSections, i, s => s.hasArcsBand)}
                  onDrag={dy => {
                    model.setReadConnectionsHeight(
                      model.readConnectionsHeight + dy,
                    )
                  }}
                  title={`Drag to resize the read connections area${scope}`}
                />
              ) : null}

              {section.hasSashimiBand ? (
                <PileupResizeHandle
                  seam={bandScreenTop(section.topOffset, scroll)}
                  canvasHeight={height}
                  gain={stackedBandGain(
                    renderSections,
                    i,
                    s => s.hasSashimiBand,
                  )}
                  onDrag={dy => {
                    model.setSashimiHeight(model.sashimiHeight + dy)
                  }}
                  title={`Drag to resize the sashimi arcs area${scope}`}
                />
              ) : null}
            </Fragment>
          )
        })}
      </>
    )
  },
)

// Per-group pileup-height drag handles (in-track grouping only). Each sits at a
// non-collapsed section's pileup bottom, below any room it reserves for a
// dipping connector, and resizes just that group's band, so
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
        const bottom = contentScreenY(
          section.topOffset + section.pileupHeight + section.dipReserve,
          scroll,
        )
        return (
          <PileupResizeHandle
            key={sectionKey(section.groupKey)}
            // The strip overhangs the seam, which here DRAWS a line
            // (`GroupLabelsOverlay`'s divider, at the next section's top): a
            // strip ending above it left the visible line the one place the
            // pointer got no answer.
            seam={bottom}
            canvasHeight={height}
            onDrag={dy => {
              model.resizeGroupHeight(section.groupKey, dy)
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
