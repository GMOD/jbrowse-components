import { useFocusOnInteraction, useWidthSetter } from '@jbrowse/core/util/hooks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import ViewHeader from './ViewHeader.tsx'
import ViewWrapper from './ViewWrapper.tsx'
import { useViewVisibility } from './useViewVisibility.ts'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

// Intended to keep views mounted within ~1.5 viewport-heights of the visible
// band. **It does nothing, and making it work was measured as a regression.**
//
// An observer clips the target against every scrolling ancestor before applying
// the margin, which expands only the root's box — and both view containers are
// `overflow-y: auto`, so through one of them `150% 0px` qualifies exactly the
// views a `0px` margin would. Rooting the observer at the scroll port instead
// (`scrollPortOf`) does restore the band, and it comes out a wash on scroll cost
// while holding 9-13 live GPU canvases instead of 6: the mount band trades
// pipeline rebuilds for live contexts, and the context cap is the tighter
// constraint. See agent-docs/handoffs/workspaces-freeze.md.
//
// So don't tune this number expecting an effect, and don't make it live without
// first cutting contexts per display.
const VIEW_VISIBILITY_ROOT_MARGIN = '150% 0px'

// Scroll-space reserved for a view that has never been measured yet, so a fresh
// load spreads views down the page instead of stacking them all in the viewport
// (which would mark them all visible and defeat the lazy mount).
const ESTIMATED_VIEW_HEIGHT = 400

function viewHeight(view: AbstractViewModel) {
  return 'height' in view && typeof view.height === 'number'
    ? view.height
    : ESTIMATED_VIEW_HEIGHT
}

// Every view that waits on something before it can mount content (LGV, dotplot,
// synteny, circular, breakpoint-split — all of which paint a spinner in place of
// their whole body meanwhile) models that wait as `showLoading`. Views without
// the getter are mounted content the moment they render.
//
// Two values, not one per render branch: an import form is finished content, not
// a pending state, so it reports ready like anything else.
function viewPhase(view: AbstractViewModel) {
  return 'showLoading' in view && view.showLoading === true
    ? 'loading'
    : 'ready'
}

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
    overflow: 'clip',
    // xref https://stackoverflow.com/questions/43909940/why-does-overflowhidden-prevent-positionsticky-from-working
    // note that contain:paint also seems to work
  },
  focusedView: {
    background: theme.palette.secondary.main,
  },
  unfocusedView: {
    background: theme.palette.secondary.dark,
  },
}))

const ViewContainer = observer(function ViewContainer({
  view,
  session,
  scrollOnMount,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
  scrollOnMount?: boolean
}) {
  const ref = useWidthSetter(view)
  const { classes } = useStyles()
  const {
    ref: bodyRef,
    visible,
    placeholderHeight,
  } = useViewVisibility(VIEW_VISIBILITY_ROOT_MARGIN, viewHeight(view))

  useFocusOnInteraction(ref, () => {
    session.setFocusedViewId(view.id)
  })

  // A minimized view renders no body, so it neither mounts the (GPU-heavy) view
  // component nor reserves placeholder scroll-space; a spacer would otherwise
  // re-expand the collapsed view to its pre-minimize height as soon as it
  // scrolled out of the viewport.
  const { minimized } = view
  const showBody = visible && !minimized
  const reserveSpace = !visible && !minimized

  const backgroundColorClassName =
    session.focusedViewId === view.id
      ? classes.focusedView
      : classes.unfocusedView
  const viewContainerClassName = cx(
    classes.viewContainer,
    backgroundColorClassName,
  )

  return (
    <Paper
      ref={ref}
      elevation={12}
      className={viewContainerClassName}
      data-testid={`view-container-${view.id}`}
      // the view-level counterpart of DisplayChrome's data-display-phase: while
      // this reads `loading` the view has no displays mounted, so every
      // display-level readiness signal is silent and a capture taken now lands on
      // a bare spinner (see waitForViewPhases in @jbrowse/browser-test-utils)
      data-view-phase={viewPhase(view)}
    >
      <ViewHeader
        view={view}
        onClose={() => {
          session.removeView(view)
        }}
        onMinimize={() => {
          view.setMinimized(!view.minimized)
        }}
        className={backgroundColorClassName}
        scrollOnMount={scrollOnMount}
      />
      <Paper elevation={0}>
        {/* stays mounted even when empty, so the visibility observer keeps a
        stable node to watch */}
        <div
          ref={bodyRef}
          style={reserveSpace ? { height: placeholderHeight } : undefined}
        >
          {showBody ? <ViewWrapper view={view} session={session} /> : null}
        </div>
      </Paper>
    </Paper>
  )
})

export default ViewContainer
