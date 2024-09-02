import React, { useEffect, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'

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
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

const ViewHeader = observer(function ({
  view,
  onClose,
  onMinimize,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
}) {
  const { classes, cx } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    if (typeof jest === 'undefined') {
      scrollRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [])
  return (
    <div ref={scrollRef} className={cx('viewHeader', classes.viewHeader)}>
      <ViewMenu model={view} IconProps={{ className: classes.icon }} />
      <div className={classes.grow} />
      <div className={classes.viewTitle}>
        {session.focusedViewId === view.id ? (
          <KeyboardArrowRightIcon className={classes.icon} fontSize="small" />
        ) : null}
        <ViewContainerTitle view={view} />
      </div>
      <div className={classes.grow} />
      <ViewHeaderButtons
        onClose={onClose}
        onMinimize={onMinimize}
        view={view}
      />
    </div>
  )
})

export default ViewHeader
