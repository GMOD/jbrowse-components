import { Suspense } from 'react'

import { useMouseState } from '@jbrowse/core/ui'
import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import BottomRightIndicators from '@jbrowse/display-kit/BottomRightIndicators'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import TrackHeightIndicator from '@jbrowse/display-kit/TrackHeightIndicator'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import { AlignmentsRenderer } from '../renderers/AlignmentsRenderer.ts'
import PileupBody from './PileupComponent.tsx'

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

// The corner controls, in their own observer for the reason every other layer
// here is: the render-prop child below is invoked during `DisplayChromeBase`'s
// render, so an observable read written *inline* in it is tracked by the CHROME,
// not by this file's component. These reads (`scrollableHeight` twice,
// `heightMode`, `view.scrollZoom`) sat there, so flipping the height mode
// re-rendered `DisplayChrome` itself — `useRenderingBackend` re-run, the status
// container rebuilt, the overlay portal re-created — to redraw a chip. None of
// them moves per frame, so this was never hot; it is the same shape wiggle and
// the variant matrix WERE hot in.
const AlignmentsCornerControls = observer(function AlignmentsCornerControls({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  // The guard travels with the read it was written for. Hiding a track detaches
  // the display, firing MobX reactions synchronously inside the click handler —
  // and this observer reads `getContainingView`, which throws outright on a
  // detached node. Relying on the parent re-rendering first would be relying on
  // reaction order.
  if (!isAlive(model)) {
    return null
  }
  const view = getContainingView(model) as LinearGenomeViewModel
  const hasOverflow = model.scrollableHeight > 0
  return (
    // The pileup's own scrollbar sits on the same edge, so the row has to clear
    // it while it is drawn. Same expression as the canvas display's: the
    // scrollbar's track plus a hairline. Passing nothing here drew these chips
    // over the thumb.
    <BottomRightIndicators
      scrollbarWidth={hasOverflow ? VERTICAL_SCROLLBAR_CLEARANCE : 0}
    >
      <TrackHeightIndicator
        heightMode={model.heightMode}
        hasOverflow={hasOverflow}
        scrollZoom={view.scrollZoom}
        noun={model.featureNoun}
        onSetHeightMode={mode => {
          model.setHeightMode(mode)
        }}
      />
    </BottomRightIndicators>
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
    // observer re-renders once before React unmounts it. Bail out while
    // detached. It reads no model field of its own any more, but `isAlive` still
    // guards the children it builds.
    if (!isAlive(model)) {
      return null
    }
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
        {/* Components only, no inline reads — see AlignmentsCornerControls. */}
        {({ canvasRef, mouseTracker }) => (
          <>
            <PileupBody model={model} canvasRef={canvasRef} />
            <AlignmentsCornerControls model={model} />
            <AlignmentsTooltipLayer model={model} mouseTracker={mouseTracker} />
            <DisplayContextMenu model={model} />
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default AlignmentsDisplayComponent
