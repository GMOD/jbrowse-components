import { Suspense, useState } from 'react'

import {
  ErrorBanner,
  LoadingEllipses,
  PluggableComponent,
} from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import LaunchIcon from '@mui/icons-material/Launch'
import MinimizeIcon from '@mui/icons-material/Minimize'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  AppBar,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithDrawerWidgets } from '../Session/DrawerWidgets.ts'

const useStyles = makeStyles()(theme => ({
  paper: {
    overflowY: 'auto',
    height: '100%',
    position: 'relative',
    zIndex: theme.zIndex.drawer,
    outline: 'none',
    background: theme.palette.background.default,
  },
  resizeHandle: {
    width: 4,
    position: 'fixed',
    top: 0,
    zIndex: theme.zIndex.drawer + 1,
  },
  appBar: {
    background: theme.palette.secondary.main,
  },
  spacer: {
    flexGrow: 1,
  },
  formControl: {
    margin: 0,
  },
  drawerSelect: {
    margin: 0,
    color: theme.palette.secondary.contrastText,
  },
  dropDownIcon: {
    color: theme.palette.secondary.contrastText,
  },
}))

const DrawerWidgetSelector = observer(function DrawerWidgetSelector({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { visibleWidget, activeWidgets } = session
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  return (
    <FormControl className={classes.formControl}>
      <Select
        value={visibleWidget?.id || ''}
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
          if (!widgetType) {
            throw new Error(`unknown widget type ${widget.type}`)
          }
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
          }
        }}
      >
        {[...activeWidgets.values()].map(widget => {
          const widgetType = pluginManager.getWidgetType(widget.type)
          if (!widgetType) {
            throw new Error(`unknown widget type ${widget.type}`)
          }
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
                onClick={() => {
                  session.hideWidget(widget)
                }}
              >
                <CloseIcon />
              </IconButton>
            </MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
})

const DrawerControls = observer(function DrawerControls({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { drawerPosition, visibleWidget } = session
  return (
    <>
      <IconButton
        color="inherit"
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Tooltip title="Minimize drawer">
        <IconButton
          data-testid="drawer-minimize"
          color="inherit"
          onClick={() => {
            session.minimizeWidgetDrawer()
          }}
        >
          <MinimizeIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Close drawer">
        <IconButton
          color="inherit"
          onClick={() => {
            if (visibleWidget) {
              session.hideWidget(visibleWidget)
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null)
        }}
      >
        {['left', 'right'].map(option => (
          <MenuItem
            key={option}
            selected={drawerPosition === option}
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

const DrawerHeader = observer(function DrawerHeader({
  session,
  setToolbarHeight,
  onPopoutDrawer,
}: {
  session: SessionWithDrawerWidgets
  setToolbarHeight: (arg: number) => void
  onPopoutDrawer: () => void
}) {
  const { classes } = useStyles()
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)
  const widgetType = visibleWidget
    ? pluginManager.getWidgetType(visibleWidget.type)
    : undefined

  return (
    <AppBar
      position="sticky"
      className={classes.appBar}
      ref={ref => {
        setToolbarHeight(ref?.getBoundingClientRect().height ?? 0)
      }}
    >
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
        <Tooltip title="Open drawer in dialog">
          <IconButton
            color="inherit"
            onClick={() => {
              onPopoutDrawer()
            }}
          >
            <LaunchIcon />
          </IconButton>
        </Tooltip>
        <div className={classes.spacer} />
        <DrawerControls session={session} />
      </Toolbar>
    </AppBar>
  )
})

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { visibleWidget, drawerPosition, drawerWidth } = session
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  const widgetType = visibleWidget
    ? pluginManager.getWidgetType(visibleWidget.type)
    : null
  if (visibleWidget && !widgetType) {
    throw new Error(`unknown widget type ${visibleWidget.type}`)
  }

  if (!visibleWidget) {
    return null
  }

  const { ReactComponent } = widgetType!

  return (
    <Paper className={classes.paper} elevation={16} square>
      <DrawerHeader
        onPopoutDrawer={() => {
          // no-op for now, drawer is always in-drawer
        }}
        session={session}
        setToolbarHeight={setToolbarHeight}
      />
      <Suspense fallback={<LoadingEllipses />}>
        <ErrorBoundary
          FallbackComponent={({ error }) => <ErrorBanner error={error} />}
        >
          <PluggableComponent
            pluginManager={pluginManager}
            name="Core-replaceWidget"
            component={ReactComponent}
            props={{
              model: visibleWidget,
              session,
              toolbarHeight,
            }}
          />
          <div style={{ height: 300 }} />
        </ErrorBoundary>
      </Suspense>
      {drawerPosition === 'right' ? (
        <ResizeHandle
          onDrag={session.resizeDrawer}
          className={classes.resizeHandle}
          vertical
        />
      ) : null}
      {drawerPosition === 'left' ? (
        <ResizeHandle
          onDrag={session.resizeDrawer}
          className={classes.resizeHandle}
          style={{ left: drawerWidth }}
          vertical
        />
      ) : null}
    </Paper>
  )
})

export default DrawerWidget
