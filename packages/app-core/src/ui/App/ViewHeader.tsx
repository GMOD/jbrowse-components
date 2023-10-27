import React, { useEffect, useRef } from 'react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'

// locals
import ViewMenu from './ViewMenu'
import ViewContainerTitle from './ViewContainerTitle'
import {
  SessionWithFocusedViewAndDrawerWidgets,
  getSession,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  iconFocused: {
    stroke: theme.palette.secondary.contrastText,
    strokeWidth: 2,
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
  const session = getSession(view) as SessionWithFocusedViewAndDrawerWidgets

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])
  return (
    <div ref={scrollRef} className={classes.viewHeader}>
      <ViewMenu
        model={view}
        IconProps={{
          className: cx(
            classes.icon,
            session.focusedViewId === view.id ? classes.iconFocused : '',
          ),
        }}
      />
      <div className={classes.grow} />

      <div className={classes.viewTitle}>
        {session.focusedViewId === view.id ? (
          <KeyboardArrowRightIcon
            className={cx(classes.icon, classes.iconFocused)}
            fontSize="small"
          />
        ) : null}
        <ViewContainerTitle view={view} />
      </div>
      <div className={classes.grow} />
      <IconButton data-testid="minimize_view" onClick={onMinimize}>
        {view.minimized ? (
          <AddIcon
            className={cx(
              classes.icon,
              session.focusedViewId === view.id ? classes.iconFocused : '',
            )}
            fontSize="small"
          />
        ) : (
          <MinimizeIcon
            className={cx(
              classes.icon,
              session.focusedViewId === view.id ? classes.iconFocused : '',
            )}
            fontSize="small"
          />
        )}
      </IconButton>
      <IconButton data-testid="close_view" onClick={onClose}>
        <CloseIcon
          className={cx(
            classes.icon,
            session.focusedViewId === view.id ? classes.iconFocused : '',
          )}
          fontSize="small"
        />
      </IconButton>
    </div>
  )
})

export default ViewHeader
