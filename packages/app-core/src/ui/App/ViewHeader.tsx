import { useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { isSessionWithMultipleViews } from '@jbrowse/product-core'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import { observer } from 'mobx-react'

import ViewButtons from './ViewButtons'
import ViewContainerTitle from './ViewContainerTitle'
import ViewMenu from './ViewMenu'

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
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
  className?: string
}) {
  const { classes } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)
  let stickyViewHeaders = false
  if (isSessionWithMultipleViews(session)) {
    ;({ stickyViewHeaders } = session)
  }

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    if (typeof jest === 'undefined') {
      scrollRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [])
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
