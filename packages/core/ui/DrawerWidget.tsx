import React, { Suspense, useState } from 'react'
import {
  AppBar,
  IconButton,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  Select,
  Toolbar,
  Typography,
  makeStyles,
  alpha,
} from '@material-ui/core'
import DeleteIcon from '@material-ui/icons/Delete'
import CloseIcon from '@material-ui/icons/Close'
import MinimizeIcon from '@material-ui/icons/Minimize'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { SessionWithDrawerWidgets } from '@jbrowse/core/util/types'
import Drawer from './Drawer'

const useStyles = makeStyles(theme => ({
  drawerActions: {
    float: 'right',
    '&:hover': {
      backgroundColor: alpha(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  drawerToolbar: {
    paddingLeft: theme.spacing(2),
  },
  spacer: {
    flexGrow: 1,
  },
  drawerSelect: {
    color: theme.palette.secondary.contrastText,
  },
  drawerLoading: {
    margin: theme.spacing(2),
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
    const classes = useStyles()

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)

    return (
      <AppBar
        position="sticky"
        className={classes.header}
        ref={(ref: HTMLDivElement) =>
          setToolbarHeight(ref?.getBoundingClientRect().height || 0)
        }
      >
        <Toolbar disableGutters className={classes.drawerToolbar}>
          <Select
            value={visibleWidget?.id}
            data-testid="widget-drawer-selects"
            className={classes.drawerSelect}
            classes={{ icon: classes.dropDownIcon }}
            renderValue={widgetId => {
              const widget = session.activeWidgets.get(widgetId as string)
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
              const w = session.activeWidgets.get(e.target.value as string)
              if (!w) {
                session.notify('Widget not found ' + e.target.value, 'warning')
              }
              session.showWidget(w)
            }}
          >
            {Array.from(activeWidgets.values()).map(widget => {
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
                  <ListItemSecondaryAction>
                    <IconButton
                      data-testid={`${widget.type}-drawer-delete`}
                      color="inherit"
                      aria-label="Delete"
                      onClick={() => {
                        session.hideWidget(widget)
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </MenuItem>
              )
            })}
          </Select>
          <div className={classes.spacer} />
          <div>
            <IconButton
              data-testid="drawer-close"
              color="inherit"
              onClick={event => setAnchorEl(event.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
            <IconButton
              data-testid="drawer-minimize"
              color="inherit"
              onClick={() => {
                session.minimizeWidgetDrawer()
              }}
            >
              <MinimizeIcon />
            </IconButton>
            <IconButton
              data-testid="drawer-close"
              color="inherit"
              onClick={() => {
                session.hideWidget(visibleWidget)
              }}
            >
              <CloseIcon />
            </IconButton>
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
      ? pluginManager.getWidgetType(visibleWidget.type).ReactComponent
      : null

    // we track the toolbar height because components that use virtualized
    // height want to be able to fill the contained, minus the toolbar height
    // (the position static/sticky is included in AutoSizer estimates)
    const [toolbarHeight, setToolbarHeight] = useState(0)

    return (
      <Drawer session={session}>
        <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
        <Suspense fallback={<div>Loading...</div>}>
          <DrawerComponent
            model={visibleWidget}
            session={session}
            toolbarHeight={toolbarHeight}
          />
        </Suspense>
      </Drawer>
    )
  },
)

export default DrawerWidget
