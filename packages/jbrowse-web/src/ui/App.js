import { readConfObject } from '@gmod/jbrowse-core/configuration'
import AppBar from '@material-ui/core/AppBar'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slide from '@material-ui/core/Slide'
import { withStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'

import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useEffect } from 'react'
import { withSize } from 'react-sizeme'
import { Scrollbars } from 'react-custom-scrollbars'

import Drawer from './Drawer'

const styles = theme => ({
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
  menuBars: {},
  menuBarsAndComponents: {
    display: 'flex',
    flexDirection: 'column',
  },
  components: {},
  drawerCloseButton: {
    float: 'right',
  },
  defaultDrawer: {
    margin: theme.spacing(1),
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
  developer: {
    background: 'white',
    padding: '0 10px 10px 10px',
  },
})

function App(props) {
  const { classes, size, session } = props

  const { pluginManager } = session

  useEffect(() => {
    session.updateWidth(size.width)
  }, [session, size])

  const { visibleDrawerWidget } = session
  let drawerComponent
  if (visibleDrawerWidget) {
    const {
      LazyReactComponent,
      HeadingComponent,
      heading,
    } = pluginManager.getDrawerWidgetType(visibleDrawerWidget.type)
    drawerComponent = (
      <Slide direction="left" in>
        <div>
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
    )
  }

  return (
    <div className={classes.root}>
      <div className={classes.menuBarsAndComponents}>
        <div className={classes.menuBars}>
          {session.menuBars.map(menuBar => {
            const { LazyReactComponent } = pluginManager.getMenuBarType(
              menuBar.type,
            )
            return (
              <React.Suspense
                key={`view-${menuBar.id}`}
                fallback={<div>Loading...</div>}
              >
                <LazyReactComponent
                  key={`view-${menuBar.id}`}
                  model={menuBar}
                  session={session}
                />
              </React.Suspense>
            )
          })}
        </div>
        <Scrollbars
          className={classes.components}
          style={{ width: session.width }}
        >
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
          <div className={classes.developer}>
            <h3>Developer tools</h3>
            <button
              type="button"
              onClick={() => {
                if (!session.datasets.length)
                  throw new Error(`Must add a dataset before adding a view`)
                session.addLinearGenomeViewOfDataset(
                  readConfObject(session.datasets[0], 'name'),
                )
              }}
            >
              Add linear view
            </button>
          </div>
        </Scrollbars>
      </div>
      <Drawer
        session={session}
        open={Boolean(session.activeDrawerWidgets.size)}
      >
        {drawerComponent}
      </Drawer>
    </div>
  )
}

App.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  size: ReactPropTypes.objectOf(ReactPropTypes.number).isRequired,
  session: PropTypes.observableObject.isRequired,
}

export default withSize()(withStyles(styles)(observer(App)))
