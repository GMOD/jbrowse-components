import React, { useEffect, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'

// icons
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'

// locals
import ViewMenu from './ViewMenu'
import ViewContainerTitle from './ViewContainerTitle'
import ViewHeaderButtons from './ViewHeaderButtons'

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
    zIndex: 7,
    background: theme.palette.secondary.main,
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

function Spacer() {
  const { classes } = useStyles()
  return <div className={classes.grow} />
}

const ViewHeader = observer(function ({
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
  const { classes, cx } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])
  return (
    <div ref={scrollRef} className={cx(classes.viewHeader, className)}>
      <ViewMenu model={view} IconProps={{ className: classes.icon }} />
      <Spacer />
      <div className={classes.viewTitle}>
        {session.focusedViewId === view.id ? (
          <KeyboardArrowRightIcon className={classes.icon} fontSize="small" />
        ) : null}
        <ViewContainerTitle view={view} />
      </div>
      <Spacer />
      <ViewHeaderButtons
        onClose={onClose}
        onMinimize={onMinimize}
        view={view}
      />
    </div>
  )
})

export default ViewHeader
