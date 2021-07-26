import React, { Suspense, useState } from 'react'
import {
  AppBar,
  IconButton,
  ListItemSecondaryAction,
  MenuItem,
  Select,
  Toolbar,
  Typography,
  makeStyles,
} from '@material-ui/core'
import DeleteIcon from '@material-ui/icons/Delete'
import CloseIcon from '@material-ui/icons/Close'
import MinimizeIcon from '@material-ui/icons/Minimize'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { useTheme, alpha } from '@material-ui/core/styles'
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
}))

const DrawerHeader = observer(props => {
  const { session, setToolbarHeight } = props
  const { visibleWidget, activeWidgets } = session
  const classes = useStyles()
  const handleChange = (e, option) => {
    session.showWidget(option.props.value)
  }
  const theme = useTheme()
  return (
    <AppBar
      position="sticky"
      ref={ref => setToolbarHeight(ref?.getBoundingClientRect().height || 0)}
      style={{ background: theme.palette.secondary.main }}
    >
      <Toolbar disableGutters className={classes.drawerToolbar}>
        <Select
          value={visibleWidget || ''}
          data-testid="widget-drawer-selects"
          className={classes.drawerSelect}
          classes={{ icon: classes.dropDownIcon }}
          renderValue={selected => {
            const {
              HeadingComponent: HeadingComp,
              heading: headingText,
            } = getEnv(session).pluginManager.getWidgetType(selected.type)
            return (
              <Typography variant="h6" color="inherit">
                {HeadingComp ? (
                  <HeadingComp model={selected} />
                ) : (
                  headingText || undefined
                )}
              </Typography>
            )
          }}
          onChange={(e, value) => {
            handleChange(e, value)
          }}
        >
          {Array.from(activeWidgets.values()).map((widget, index) => {
            const {
              HeadingComponent: HeadingComp,
              heading: headingText,
            } = getEnv(session).pluginManager.getWidgetType(widget.type)
            return (
              <MenuItem
                data-testid={`widget-drawer-selects-item-${widget.type}`}
                key={`${widget.id}-${index}`}
                value={widget}
              >
                <Typography variant="h6" color="inherit">
                  {HeadingComp ? (
                    <HeadingComp model={widget} />
                  ) : (
                    headingText || undefined
                  )}
                </Typography>
                <ListItemSecondaryAction>
                  <IconButton
                    className={classes.drawerCloseButton}
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
        <div className={classes.drawerCloseButton}>
          <IconButton
            className={classes.drawerCloseButton}
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
    </AppBar>
  )
})

const DrawerWidget = observer(({ session }) => {
  const { visibleWidget, activeWidgets } = session
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getWidgetType(visibleWidget.type)

  // we track the toolbar height because components that use virtualized height
  // want to be able to fill the contained, minus the toolbar height (the
  // position static/sticky is included in AutoSizer estimates)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  return (
    <Drawer session={session} open={Boolean(activeWidgets.size)}>
      <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
      <Suspense fallback={<div>Loading...</div>}>
        <ReactComponent
          model={visibleWidget}
          session={session}
          toolbarHeight={toolbarHeight}
        />
      </Suspense>
    </Drawer>
  )
})

export default DrawerWidget
