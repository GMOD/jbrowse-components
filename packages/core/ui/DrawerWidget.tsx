import React, { Suspense, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
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
import { getEnv } from '../util'
import LoadingEllipses from './LoadingEllipses'
import { SessionWithDrawerWidgets } from '../util/types'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import MoreVertIcon from '@mui/icons-material/MoreVert'

// locals
import Drawer from './Drawer'
import ErrorMessage from './ErrorMessage'

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
}))

const DrawerHeader = observer(
  ({
    session,
    setToolbarHeight,
  }: {
    session: SessionWithDrawerWidgets
    setToolbarHeight: (arg: number) => void
  }) => {
    const { pluginManager } = getEnv(session)
    const { visibleWidget, activeWidgets, drawerPosition } = session
    const { classes } = useStyles()

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    return (
      <AppBar
        position="sticky"
        className={classes.header}
        ref={ref => setToolbarHeight(ref?.getBoundingClientRect().height || 0)}
      >
        <Toolbar disableGutters>
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
                  session.notify(
                    `Widget not found ${e.target.value}`,
                    'warning',
                  )
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
          <div className={classes.spacer} />
          <div>
            <IconButton
              data-testid="drawer-close"
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
                data-testid="drawer-close"
                color="inherit"
                onClick={() => session.hideWidget(visibleWidget)}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </div>
        </Toolbar>
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
      </AppBar>
    )
  },
)

const DrawerWidget = observer(
  ({ session }: { session: SessionWithDrawerWidgets }) => {
    const { visibleWidget } = session
    const { pluginManager } = getEnv(session)

    const DrawerComponent = visibleWidget
      ? (pluginManager.evaluateExtensionPoint(
          'Core-replaceWidget',
          pluginManager.getWidgetType(visibleWidget.type).ReactComponent,
          {
            session,
            model: visibleWidget,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as React.FC<any>)
      : null

    // we track the toolbar height because components that use virtualized
    // height want to be able to fill the contained, minus the toolbar height
    // (the position static/sticky is included in AutoSizer estimates)
    const [toolbarHeight, setToolbarHeight] = useState(0)

    return (
      <Drawer session={session}>
        <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
        <Suspense fallback={<LoadingEllipses />}>
          <ErrorBoundary
            FallbackComponent={({ error }) => <ErrorMessage error={error} />}
          >
            {DrawerComponent ? (
              <DrawerComponent
                model={visibleWidget}
                session={session}
                toolbarHeight={toolbarHeight}
              />
            ) : null}
          </ErrorBoundary>
        </Suspense>
      </Drawer>
    )
  },
)

export default DrawerWidget
