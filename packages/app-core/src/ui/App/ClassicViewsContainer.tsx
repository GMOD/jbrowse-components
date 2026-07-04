import { useRef } from 'react'

import { normalizeWheelDelta } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

// Optional symmetric left/right margins (off by default, toggled by the
// `viewMargins` preference) that double as reliable mouse-wheel targets for
// vertical page scroll. Views consume vertical wheel over their own body
// (scroll-zoom zooms, tall internally-scrolling tracks scroll their own
// content), so these gutters — which sit outside every view's wheel listener —
// are where wheeling always scrolls the page. They're transparent, reading as
// plain page margins rather than a UI element.
//
// Revert cleanly by deleting SCROLL_GUTTER_WIDTH, the `viewsColumn`/`gutter`
// styles, the ref + gutter divs, and moving `overflowY: 'auto'` back onto
// `container` (dropping `display: 'flex'`).
const SCROLL_GUTTER_WIDTH = 24

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
    display: 'flex',
  },
  viewsColumn: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
  },
  gutter: {
    flexShrink: 0,
    width: SCROLL_GUTTER_WIDTH,
    // transparent at rest (reads as a page margin); a faint tint on hover
    // reveals it as a scroll zone without adding a permanent UI element
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  spacer: {
    height: 300,
  },
}))

interface Props {
  session: SessionWithFocusedViewAndDrawerWidgets
}

const ClassicViewsContainer = observer(function ClassicViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const { views, viewMargins } = session
  const viewsRef = useRef<HTMLDivElement>(null)

  function scrollViews(event: React.WheelEvent) {
    const el = viewsRef.current
    if (el) {
      el.scrollTop += normalizeWheelDelta(
        event.deltaY,
        event.deltaMode,
        el.clientHeight,
      )
    }
  }

  return (
    <div className={classes.container}>
      {viewMargins ? (
        <div
          className={classes.gutter}
          onWheel={event => {
            scrollViews(event)
          }}
        />
      ) : null}
      <div className={classes.viewsColumn} ref={viewsRef}>
        {views.map(view => (
          <ViewContainer key={view.id} view={view} session={session} />
        ))}
        <div className={classes.spacer} />
      </div>
      {viewMargins ? (
        <div
          className={classes.gutter}
          onWheel={event => {
            scrollViews(event)
          }}
        />
      ) : null}
    </div>
  )
})

export default ClassicViewsContainer
