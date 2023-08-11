import React, { useState } from 'react'
import {
  AppBar,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getEnv } from '@jbrowse/core/util'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import MoreVertIcon from '@mui/icons-material/MoreVert'

const useStyles = makeStyles()(theme => ({
  formControl: {
    margin: 0,
  },
  spacer: {
    flexGrow: 1,
  },
  drawerSelect: {
    margin: 0,
    color: theme.palette.secondary.contrastText,
  },

  dropDownIcon: {
    color: theme.palette.secondary.contrastText,
  },
  header: {
    background: theme.palette.secondary.main,
  },
  headerFocused: {
    background: theme.palette.secondary.light,
  },
  headerUnfocused: {
    background: theme.palette.secondary.dark,
  },
}))

export default observer(function ({
  session,
  setToolbarHeight,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
  setToolbarHeight: (arg: number) => void
}) {
  const { classes } = useStyles()
  const focusedViewId = session.focusedViewId
  // @ts-ignore
  const viewWidgetId = session.visibleWidget?.view?.id
  const isFocused = focusedViewId && focusedViewId === viewWidgetId

  return (
    <AppBar
      position="sticky"
      className={
        isFocused
          ? `${classes.headerFocused}`
          : viewWidgetId
          ? `${classes.headerUnfocused}`
          : classes.header
      }
      ref={ref => setToolbarHeight(ref?.getBoundingClientRect().height || 0)}
    >
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
        <div className={classes.spacer} />
        <DrawerControls session={session} />
      </Toolbar>
    </AppBar>
  )
})

const DrawerWidgetSelector = observer(function ({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { visibleWidget, activeWidgets } = session
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  return (
    <FormControl className={classes.formControl}>
      <Select
        value={visibleWidget?.id}
        data-testid="widget-drawer-selects"
        className={classes.drawerSelect}
        classes={{ icon: classes.dropDownIcon }}
        renderValue={widgetId => {
          const widget = session.activeWidgets.get(widgetId)
          if (!widget) {
            return (
              <Typography variant="h6" color="inherit">
                Unknown widget
              </Typography>
            )
          }
          const widgetType = pluginManager.getWidgetType(widget.type)
          const { HeadingComponent, heading } = widgetType
          return HeadingComponent ? (
            <HeadingComponent model={widget} />
          ) : (
            <Typography variant="h6" color="inherit">
              {heading}
            </Typography>
          )
        }}
        onChange={e => {
          const w = session.activeWidgets.get(e.target.value)
          if (w) {
            session.showWidget(w)
          } else {
            session.notify(`Widget not found ${e.target.value}`, 'warning')
          }
        }}
      >
        {[...activeWidgets.values()].map(widget => {
          const widgetType = pluginManager.getWidgetType(widget.type)
          const { HeadingComponent, heading } = widgetType
          return (
            <MenuItem
              data-testid={`widget-drawer-selects-item-${widget.type}`}
              key={widget.id}
              value={widget.id}
            >
              {HeadingComponent ? (
                <HeadingComponent model={widget} />
              ) : (
                <Typography variant="h6" color="inherit">
                  {heading}
                </Typography>
              )}
              <IconButton
                data-testid={`${widget.type}-drawer-delete`}
                color="inherit"
                aria-label="Delete"
                onClick={() => session.hideWidget(widget)}
              >
                <DeleteIcon />
              </IconButton>
            </MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
})

const DrawerControls = observer(function ({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { drawerPosition, visibleWidget } = session
  return (
    <>
      <IconButton
        color="inherit"
        onClick={event => setAnchorEl(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
      <Tooltip title="Minimize drawer">
        <IconButton
          data-testid="drawer-minimize"
          color="inherit"
          onClick={() => {
            session.notify(
              `Drawer minimized, click button on ${drawerPosition} side of screen to re-open`,
              'info',
            )
            session.minimizeWidgetDrawer()
          }}
        >
          <MinimizeIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Close drawer">
        <IconButton
          color="inherit"
          onClick={() => session.hideWidget(visibleWidget)}
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {['left', 'right'].map(option => (
          <MenuItem
            key={option}
            selected={drawerPosition === 'option'}
            onClick={() => {
              session.setDrawerPosition(option)
              setAnchorEl(null)
            }}
          >
            {option}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
})
