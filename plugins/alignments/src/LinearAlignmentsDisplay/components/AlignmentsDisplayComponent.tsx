import { Suspense } from 'react'

import { ContextMenu, useMouseState } from '@jbrowse/core/ui'
import { VERTICAL_SCROLLBAR_WIDTH } from '@jbrowse/core/ui/VerticalScrollbar'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  BottomRightIndicators,
  DisplayChrome,
  TrackHeightIndicator,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { AlignmentsRenderer } from '../renderers/AlignmentsRenderer.ts'
import PileupBody from './PileupComponent.tsx'
import PileupTruncatedIndicator from './PileupTruncatedIndicator.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The tooltip, in its own component so that following the pointer re-renders
// the tooltip and nothing else.
//
// This used to be a `mouseCoord` useState in `AlignmentsDisplayComponent`, set
// from an `onMouseMove` on `DisplayChrome`. Two things were wrong with that, and
// both are why hovering a pileup was the most expensive hover in the app:
// the write re-rendered `DisplayChrome`, the status container and `PileupBody`
// with all its overlays — to move one tooltip — and it did so on every *raw*
// mousemove, uncoalesced, with a `getBoundingClientRect()` per event on top.
// `useMouseTracking` publishes the position instead and coalesces it to one
// update per frame. See there.

// Layout only, and deliberately no `theme =>` argument: this is the alignments
// entry in the "themed makeStyles in the display render path" list that
// EAGER_BUNDLE.md keeps, and the truncation notice was the only thing here that
// read a color. It reads the palette through `TrackControl` now.
const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

// maxHeight is in pixels; this is far above the Uint16 row ceiling so the
// `maxRows` getter clamps to the real limit and every stacked read shows.
const SHOW_ALL_MAX_HEIGHT = 1_000_000

const AlignmentsTooltipLayer = observer(function AlignmentsTooltipLayer({
  model,
  mouseTracker,
}: {
  model: LinearAlignmentsDisplayModel
  mouseTracker: MouseTracker
}) {
  const { TooltipComponent } = model
  const mouseState = useMouseState(mouseTracker)
  return (
    <Suspense fallback={null}>
      <TooltipComponent model={model} mouseState={mouseState} />
    </Suspense>
  )
})

const AlignmentsDisplayComponent = observer(
  function AlignmentsDisplayComponent({
    model,
  }: {
    model: LinearAlignmentsDisplayModel
  }) {
    const { classes } = useStyles()
    // Hiding a track detaches this display from the MST tree, which fires MobX
    // reactions synchronously inside the click handler — this still-mounted
    // observer re-renders once (reading config-backed getters like
    // `pileupTruncated`) before React unmounts it. Bail out while detached.
    if (!isAlive(model)) {
      return null
    }
    const view = getContainingView(model) as LinearGenomeViewModel

    const { pileupTruncated } = model
    return (
      <DisplayChrome
        model={model}
        factory={AlignmentsRenderer}
        // `pileup-display`, the name the screenshot specs and cypress already
        // wait on. It used to be `display-${displayId}` here with
        // `pileup-display-done` hand-written on an inner div, which is why
        // `displayReady()` in screenshot-spec-helpers needed a `:has()` variant:
        // the testid and `data-display-phase` sat on different elements. The
        // display id now rides `data-display-id` on this same element.
        testid="pileup-display"
        className={classes.display}
      >
        {({ canvasRef, canvas, mouseTracker }) => (
          <>
            <PileupBody model={model} canvasRef={canvasRef} canvas={canvas} />
            {/* The pileup's own scrollbar sits on the same edge, so the row has
                to clear it while it is drawn. Same expression as the canvas
                display's: the scrollbar's track plus a hairline. Passing nothing
                here drew these chips over the thumb. */}
            <BottomRightIndicators
              scrollbarWidth={
                model.scrollableHeight > 0 ? VERTICAL_SCROLLBAR_WIDTH + 2 : 0
              }
            >
              {pileupTruncated ? (
                <PileupTruncatedIndicator
                  onShowAll={() => {
                    model.setMaxHeight(SHOW_ALL_MAX_HEIGHT)
                  }}
                />
              ) : null}
              <TrackHeightIndicator
                heightMode={model.heightMode}
                hasOverflow={model.scrollableHeight > 0}
                scrollZoom={view.scrollZoom}
                noun="read"
                onSetHeightMode={mode => {
                  model.setHeightMode(mode)
                }}
              />
            </BottomRightIndicators>
            <AlignmentsTooltipLayer model={model} mouseTracker={mouseTracker} />
            <ContextMenu
              anchor={model.contextMenuAnchor}
              menuItems={() => model.contextMenuItems()}
              onClose={() => {
                model.closeContextMenu()
              }}
            />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default AlignmentsDisplayComponent
