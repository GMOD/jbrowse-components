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
    margin: theme.spacing.unit,
  },
  drawerToolbar: {
    paddingLeft: theme.spacing.unit * 2,
  },
  drawerToolbarCloseButton: {
    flexGrow: 1,
  },
  drawerLoading: {
    margin: theme.spacing.unit * 2,
  },
  developer: {
    background: 'white',
    padding: '0 10px 10px 10px',
  },
})

function App(props) {
  const {
    classes,
    getDrawerWidgetType,
    getViewType,
    getMenuBarType,
    rootModel,
    sessionNames,
    activeSession,
    setActiveSession,
    addSessions,
    size,
  } = props

  useEffect(() => {
    rootModel.updateWidth(size.width)
  }, [rootModel, size])

  const drawerWidgets = Array.from(rootModel.activeDrawerWidgets.values())
  let drawerComponent
  if (drawerWidgets.length) {
    const activeDrawerWidget = drawerWidgets[drawerWidgets.length - 1]
    const {
      LazyReactComponent,
      HeadingComponent,
      heading,
    } = getDrawerWidgetType(activeDrawerWidget.type)
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
                onClick={() => rootModel.hideDrawerWidget(activeDrawerWidget)}
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
              addSessions={addSessions}
              setActiveSession={setActiveSession}
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
          {rootModel.menuBars.map(menuBar => {
            const { LazyReactComponent } = getMenuBarType(menuBar.type)
            return (
              <React.Suspense
                key={`view-${menuBar.id}`}
                fallback={<div>Loading...</div>}
              >
                <LazyReactComponent
                  key={`view-${menuBar.id}`}
                  model={menuBar}
                />
              </React.Suspense>
            )
          })}
        </div>
        <Scrollbars
          className={classes.components}
          style={{ width: rootModel.width }}
        >
          {rootModel.views.map(view => {
            const { ReactComponent } = getViewType(view.type)
            return <ReactComponent key={`view-${view.id}`} model={view} />
          })}
          <div className={classes.developer}>
            <h3>Developer tools</h3>
            <button
              type="button"
              onClick={() => rootModel.addView('LinearGenomeView', {})}
            >
              Add linear view
            </button>
            <button
              type="button"
              onClick={() => rootModel.addView('CircularView', {})}
            >
              Add circular view
            </button>
            <select
              onChange={event => setActiveSession(event.target.value)}
              value={activeSession}
            >
              {sessionNames.map(sessionName => (
                <option key={sessionName} value={sessionName}>
                  {sessionName}
                </option>
              ))}
            </select>
          </div>
        </Scrollbars>
      </div>
      <Drawer
        rootModel={rootModel}
        open={Boolean(rootModel.activeDrawerWidgets.size)}
      >
        {drawerComponent}
      </Drawer>
    </div>
  )
}

App.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  rootModel: PropTypes.observableObject.isRequired,
  getViewType: ReactPropTypes.func.isRequired,
  getDrawerWidgetType: ReactPropTypes.func.isRequired,
  getMenuBarType: ReactPropTypes.func.isRequired,
  size: ReactPropTypes.objectOf(ReactPropTypes.number).isRequired,
  sessionNames: ReactPropTypes.arrayOf(ReactPropTypes.string).isRequired,
  activeSession: ReactPropTypes.string.isRequired,
  setActiveSession: ReactPropTypes.func.isRequired,
  addSessions: ReactPropTypes.func.isRequired,
}

export default withSize()(withStyles(styles)(observer(App)))
