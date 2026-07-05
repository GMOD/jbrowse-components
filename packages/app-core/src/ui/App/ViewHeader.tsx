import { useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { isSessionWithMultipleViews } from '@jbrowse/product-core'
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
    height: VIEW_HEADER_HEIGHT,
    top: 0,
    zIndex: 900,
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

const ViewHeader = observer(function ViewHeader({
  view,
  onClose,
  onMinimize,
  className,
  scrollOnMount,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
  className?: string
  scrollOnMount?: boolean
}) {
  const { classes } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)
  const stickyViewHeaders = isSessionWithMultipleViews(session)
    ? session.stickyViewHeaders
    : false

  // Scroll a newly-added view into view on mount. Gated on scrollOnMount so a
  // cold load / session restore with several views doesn't have every header
  // race to scrollIntoView (last one wins, landing on the bottom view);
  // ViewStack only sets it for views added after the initial render.
  useEffect(() => {
    if (
      scrollOnMount &&
      typeof jest === 'undefined' &&
      !navigator.webdriver &&
      window.self === window.top
    ) {
      scrollRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [scrollOnMount])
  return (
    <div
      ref={scrollRef}
      className={cx(classes.viewHeader, className)}
      style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
    >
      <ViewMenu model={view} IconProps={{ className: classes.icon }} />
      <div className={classes.grow} />
      <div className={classes.viewTitle}>
        {session.focusedViewId === view.id ? (
          <KeyboardArrowRightIcon className={classes.icon} fontSize="small" />
        ) : null}
        <ViewContainerTitle view={view} />
      </div>
      <div className={classes.grow} />
      <ViewButtons onClose={onClose} onMinimize={onMinimize} view={view} />
    </div>
  )
})

export default ViewHeader
