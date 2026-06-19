import { useFocusOnInteraction, useWidthSetter } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import ViewHeader from './ViewHeader.tsx'
import ViewWrapper from './ViewWrapper.tsx'
import { useViewVisibility } from './useViewVisibility.ts'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

// Keep views mounted within ~1.5 viewport-heights of the visible band so normal
// scrolling reveals already-drawn content rather than a blank-then-redraw.
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
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { classes } = useStyles()
  const {
    ref: bodyRef,
    visible,
    placeholderHeight,
  } = useViewVisibility(VIEW_VISIBILITY_ROOT_MARGIN, viewHeight(view))

  useFocusOnInteraction(ref, () => {
    session.setFocusedViewId(view.id)
  })

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
      />
      <Paper elevation={0}>
        <div ref={bodyRef} style={visible ? undefined : { height: placeholderHeight }}>
          {visible ? <ViewWrapper view={view} session={session} /> : null}
        </div>
      </Paper>
    </Paper>
  )
})

export default ViewContainer
