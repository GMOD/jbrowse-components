import { readConfObject } from '@gmod/jbrowse-core/configuration'
import AppBar from '@material-ui/core/AppBar'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slide from '@material-ui/core/Slide'
import { withStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'

import { PropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
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
  const {
    classes,
    size,
    session,
    sessionNames,
    addSessionSnapshot,
    activateSession,
  } = props

  const { pluginManager } = session

  useEffect(() => {
    session.updateWidth(size.width)
  }, [session, size])

  const drawerWidgets = Array.from(session.activeDrawerWidgets.values())
  let drawerComponent
  if (drawerWidgets.length) {
    const activeDrawerWidget = drawerWidgets[drawerWidgets.length - 1]
    const {
      LazyReactComponent,
      HeadingComponent,
      heading,
    } = pluginManager.getDrawerWidgetType(activeDrawerWidget.type)
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
                  <HeadingComponent model={activeDrawerWidget} />
                ) : (
                  heading || undefined
                )}
              </Typography>
              <div className={classes.drawerToolbarCloseButton} />
              <IconButton
                className={classes.drawerCloseButton}
                color="inherit"
                aria-label="Close"
                onClick={() => session.hideDrawerWidget(activeDrawerWidget)}
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
            <LazyReactComponent
              model={activeDrawerWidget}
              session={session}
              addSessionSnapshot={addSessionSnapshot}
              setActiveSession={activateSession}
            />
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
                if (!session.species.length)
                  throw new Error(`Must add a species before adding a view`)
                session.addLinearGenomeViewOfSpecies(
                  readConfObject(session.species[0], 'name'),
                )
              }}
            >
              Add linear view
            </button>
            <select
              onChange={event => activateSession(event.target.value)}
              value={session.name}
            >
              {sessionNames.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
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
  sessionNames: ReactPropTypes.arrayOf(ReactPropTypes.string).isRequired,
  addSessionSnapshot: ReactPropTypes.func.isRequired,
  activateSession: ReactPropTypes.func.isRequired,
}

export default withSize()(withStyles(styles)(observer(App)))
