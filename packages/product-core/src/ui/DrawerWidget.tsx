import { Suspense, useCallback, useState } from 'react'

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
import type PluginManager from '@jbrowse/core/PluginManager'

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

function getWidgetType(pluginManager: PluginManager, widgetTypeName: string) {
  const widgetType = pluginManager.getWidgetType(widgetTypeName)
  if (!widgetType) {
    throw new Error(`unknown widget type ${widgetTypeName}`)
  }
  return widgetType
}

const WidgetHeading = observer(function WidgetHeading({
  pluginManager,
  widget,
}: {
  pluginManager: PluginManager
  widget: { id: string; type: string }
}) {
  const { HeadingComponent, heading } = getWidgetType(
    pluginManager,
    widget.type,
  )
  return HeadingComponent ? (
    <HeadingComponent model={widget} />
  ) : (
    <Typography variant="h6" color="inherit">
      {heading}
    </Typography>
  )
})

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
        value={visibleWidget?.id ?? ''}
        data-testid="widget-drawer-selects"
        className={classes.drawerSelect}
        classes={{ icon: classes.dropDownIcon }}
        renderValue={widgetId => {
          const widget = session.activeWidgets.get(widgetId)
          return widget ? (
            <WidgetHeading pluginManager={pluginManager} widget={widget} />
          ) : (
            <Typography variant="h6" color="inherit">
              Unknown widget
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
        {[...activeWidgets.values()].map(widget => (
          <MenuItem
            data-testid={`widget-drawer-selects-item-${widget.type}`}
            key={widget.id}
            value={widget.id}
          >
            <WidgetHeading pluginManager={pluginManager} widget={widget} />
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
        ))}
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
}: {
  session: SessionWithDrawerWidgets
  setToolbarHeight: (arg: number) => void
}) {
  const { classes } = useStyles()
  const appBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      setToolbarHeight(ref?.getBoundingClientRect().height ?? 0)
    },
    [setToolbarHeight],
  )

  return (
    <AppBar position="sticky" className={classes.appBar} ref={appBarRef}>
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
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

  if (!visibleWidget) {
    return null
  }

  const { ReactComponent } = getWidgetType(pluginManager, visibleWidget.type)

  return (
    <Paper className={classes.paper} elevation={16} square>
      <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
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
        </ErrorBoundary>
      </Suspense>
      <ResizeHandle
        onDrag={distance => session.resizeDrawer(distance)}
        className={classes.resizeHandle}
        style={drawerPosition === 'left' ? { left: drawerWidth } : undefined}
        vertical
      />
    </Paper>
  )
})

export default DrawerWidget
