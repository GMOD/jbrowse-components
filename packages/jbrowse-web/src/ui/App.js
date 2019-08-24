import { clamp } from '@gmod/jbrowse-core/util'
import { makeStyles } from '@material-ui/core'
import AppBar from '@material-ui/core/AppBar'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slide from '@material-ui/core/Slide'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'
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

function App({ size, session }) {
  const classes = useStyles()

  const { pluginManager } = session
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    session.updateWidth(size.width)
  }, [session, size.width])

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
    )
  }
  const nameRef = useRef()

  if (nameRef.current) {
    nameRef.current.scrollTop = scrollTop
  }

  return (
    <div className={classes.root}>
      <div
        className={classes.menuBarsAndComponents}
        ref={nameRef}
        onWheel={event => {
          if (
            !session.shouldntScroll &&
            nameRef.current.scrollHeight > nameRef.current.clientHeight &&
            Math.abs(event.deltaY) > 2 * Math.abs(event.deltaX)
          ) {
            setScrollTop(
              clamp(
                scrollTop + event.deltaY,
                0,
                nameRef.current.scrollHeight - nameRef.current.clientHeight,
              ),
            )
          }
        }}
      >
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
  size: ReactPropTypes.objectOf(ReactPropTypes.number).isRequired,
  session: PropTypes.observableObject.isRequired,
}

export default withSize()(observer(App))
