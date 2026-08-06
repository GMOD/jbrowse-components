import { Suspense } from 'react'

import { ContextMenu, useMouseState } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  BottomRightIndicators,
  DisplayChrome,
  TrackHeightIndicator,
} from '@jbrowse/plugin-linear-genome-view'
import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import { AlignmentsRenderer } from '../renderers/AlignmentsRenderer.ts'
import PileupBody from './PileupComponent.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const COORD0: [number, number] = [0, 0]

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

const useStyles = makeStyles()(theme => ({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
  maxHeight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 4px',
    fontSize: 11,
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: 0.9,
  },
}))

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
      <TooltipComponent
        model={model}
        offsetMouseCoord={mouseState ? [mouseState.x, mouseState.y] : COORD0}
        clientMouseCoord={
          mouseState ? [mouseState.clientX, mouseState.clientY] : COORD0
        }
      />
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
            <BottomRightIndicators>
              {pileupTruncated ? (
                <div className={classes.maxHeight}>
                  <span>Max layout height reached</span>
                  <Link
                    component="button"
                    variant="caption"
                    underline="hover"
                    onClick={() => {
                      model.setMaxHeight(SHOW_ALL_MAX_HEIGHT)
                    }}
                  >
                    Show all alignments
                  </Link>
                </div>
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
