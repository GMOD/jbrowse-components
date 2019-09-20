import AppBar from '@material-ui/core/AppBar'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slide from '@material-ui/core/Slide'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useEffect } from 'react'
import { withSize } from 'react-sizeme'
import DevTools from './DevTools'
import Drawer from './Drawer'

const useStyles = makeStyles(theme => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
  root: {
    height: '100vh',
    display: 'flex',
    overflow: 'hidden',
    background: '#808080',
  },
  menuBars: {
    display: 'block',
  },
  menuBarsAndComponents: {
    flex: '1 100%',
    height: '100%',
    overflowY: 'auto',
  },
  defaultDrawer: {
    flex: '1 100%',
  },
  components: {
    display: 'block',
  },
  drawerCloseButton: {
    float: 'right',
  },
  drawerToolbar: {
    paddingLeft: theme.spacing(2),
  },
  drawerToolbarCloseButton: {
    flexGrow: 1,
  },
  drawerLoading: {
    margin: theme.spacing(2),
  },
}))

const DrawerWidget = React.memo(props => {
  const { session, LazyReactComponent, HeadingComponent, heading } = props
  const { visibleDrawerWidget } = session
  const classes = useStyles()

  return (
    <Drawer session={session} open={Boolean(session.activeDrawerWidgets.size)}>
      <Slide direction="left" in>
        <div className={classes.defaultDrawer}>
          <AppBar position="static">
            <Toolbar
              variant="dense"
              disableGutters
              className={classes.drawerToolbar}
            >
              <Typography variant="h6" color="inherit">
                {HeadingComponent ? (
                  <HeadingComponent model={visibleDrawerWidget} />
                ) : (
                  heading || undefined
                )}
              </Typography>
              <div className={classes.drawerToolbarCloseButton} />
              <IconButton
                className={classes.drawerCloseButton}
                color="inherit"
                aria-label="Close"
                onClick={() => session.hideDrawerWidget(visibleDrawerWidget)}
              >
                <Icon fontSize="small">close</Icon>
              </IconButton>
            </Toolbar>
          </AppBar>
          <React.Suspense
            fallback={
              <CircularProgress
                disableShrink
                className={classes.drawerLoading}
              />
            }
          >
            <LazyReactComponent model={visibleDrawerWidget} session={session} />
          </React.Suspense>
        </div>
      </Slide>
    </Drawer>
  )
})

DrawerWidget.propTypes = {
  session: PropTypes.observableObject.isRequired,
  LazyReactComponent: ReactPropTypes.node.isRequired,
  heading: ReactPropTypes.string.isRequired,
  HeadingComponent: ReactPropTypes.node.isRequired,
}

function App({ size, session }) {
  const classes = useStyles()

  const { pluginManager } = session

  useEffect(() => {
    session.updateWidth(size.width)
  }, [session, size.width])

  const { visibleDrawerWidget } = session
  const {
    LazyReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getDrawerWidgetType(visibleDrawerWidget.type)
  return (
    <div className={classes.root}>
      <div className={classes.menuBarsAndComponents}>
        <div className={classes.menuBars}>
          {session.menuBars.map(menuBar => {
            const {
              LazyReactComponent: MenuBarLazyReactComponent,
            } = pluginManager.getMenuBarType(menuBar.type)
            return (
              <React.Suspense
                key={`view-${menuBar.id}`}
                fallback={<div>Loading...</div>}
              >
                <MenuBarLazyReactComponent
                  key={`view-${menuBar.id}`}
                  model={menuBar}
                  session={session}
                />
              </React.Suspense>
            )
          })}
        </div>
        <div className={classes.components}>
          {session.views.map(view => {
            const { ReactComponent } = pluginManager.getViewType(view.type)
            return (
              <ReactComponent
                key={`view-${view.id}`}
                model={view}
                session={session}
                getTrackType={pluginManager.getTrackType}
              />
            )
          })}
          <DevTools session={session} />
        </div>
      </div>

      {visibleDrawerWidget ? (
        <DrawerWidget
          LazyReactComponent={LazyReactComponent}
          HeadingComponent={HeadingComponent}
          heading={heading}
          session={session}
        />
      ) : null}
    </div>
  )
}

App.propTypes = {
  size: ReactPropTypes.objectOf(ReactPropTypes.number).isRequired,
  session: PropTypes.observableObject.isRequired,
}

export default withSize()(observer(App))
