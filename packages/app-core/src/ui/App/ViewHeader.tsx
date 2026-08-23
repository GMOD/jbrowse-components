import { useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  VIEW_HEADER_HEIGHT_VAR,
  useChromeHeightVar,
} from '@jbrowse/core/util/hooks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import { observer } from 'mobx-react'

import ViewButtons from './ViewButtons.tsx'
import ViewContainerTitle from './ViewContainerTitle.tsx'
import ViewMenu from './ViewMenu.tsx'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  grow: {
    flexGrow: 1,
  },
  viewHeader: {
    display: 'flex',
    // a minimum, not a height: the constant exists so the sticky boxes below
    // can clear this one, and pinning the box to it clipped the title row at a
    // larger root font size. `useChromeHeightVar` publishes what it actually
    // measures, so growing here moves them rather than overlapping them
    minHeight: VIEW_HEADER_HEIGHT,
    top: 0,
    zIndex: 900,
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

// The one thing in the header that depends on which view has focus, kept in its
// own observer so the header does not. Read from ViewHeader itself,
// `focusedViewId` made a single click re-render every view's header and the MUI
// subtree under it (a Tooltip, three IconButtons and the menu), because an
// observer re-renders on its own observable change whatever its props say. Here
// a click re-renders N nodes that mostly render nothing.
const ViewFocusIndicator = observer(function ViewFocusIndicator({
  view,
  className,
}: {
  view: IBaseViewModel
  className?: string
}) {
  return getSession(view).focusedViewId === view.id ? (
    <KeyboardArrowRightIcon className={className} fontSize="small" />
  ) : null
})

const ViewHeader = observer(function ViewHeader({
  view,
  className,
  scrollOnMount,
}: {
  view: IBaseViewModel
  className?: string
  scrollOnMount?: boolean
}) {
  const { classes } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  useChromeHeightVar(scrollRef, VIEW_HEADER_HEIGHT_VAR)
  const stickyViewHeaders = getSession(view).stickyViewHeaders === true

  // Scroll a newly-added view into view on mount. Gated on scrollOnMount so a
  // cold load / session restore with several views doesn't have every header
  // race to scrollIntoView (last one wins, landing on the bottom view);
  // ViewStack only sets it for views added after the initial render.
  useEffect(() => {
    if (scrollOnMount && !navigator.webdriver && window.self === window.top) {
      scrollRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [scrollOnMount])
  return (
    <div
      ref={scrollRef}
      className={cx(classes.viewHeader, className)}
      style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
    >
      <ViewMenu model={view} className={classes.icon} />
      <div className={classes.grow} />
      <div className={classes.viewTitle}>
        <ViewFocusIndicator view={view} className={classes.icon} />
        <ViewContainerTitle view={view} />
      </div>
      <div className={classes.grow} />
      <ViewButtons view={view} />
    </div>
  )
})

export default ViewHeader
