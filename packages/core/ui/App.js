import { makeStyles } from '@material-ui/core/styles'

import { observer, PropTypes } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useEffect } from 'react'
import { withContentRect } from 'react-measure'
import ErrorBoundary from 'react-error-boundary'

import { inDevelopment } from '../util'
import DrawerWidget from './DrawerWidget'
import DevTools from './DevTools'
import ErrorSnackbar from './ErrorSnackbar'

const useStyles = makeStyles(() => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
  root: {
    height: '100vh',
    display: 'flex',
    overflow: 'hidden',
    // background: '#808080',
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
}))

function App({ contentRect, measureRef, session }) {
  const classes = useStyles()
  const { pluginManager } = session
  useEffect(() => {
    if (contentRect.bounds.width) {
      if (isAlive(session)) {
        session.updateWidth(contentRect.bounds.width)
      }
    }
  }, [session, contentRect])

  const { visibleDrawerWidget } = session

  return (
    <div ref={measureRef} className={classes.root}>
      <ErrorBoundary FallbackComponent={ErrorSnackbar}>
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
            {inDevelopment ? <DevTools session={session} /> : null}
          </div>
        </div>

        {visibleDrawerWidget ? <DrawerWidget session={session} /> : null}
      </ErrorBoundary>
    </div>
  )
}

App.propTypes = {
  session: PropTypes.observableObject.isRequired,
  contentRect: ReactPropTypes.shape({
    bounds: ReactPropTypes.shape({ width: ReactPropTypes.number }),
  }).isRequired,
  measureRef: ReactPropTypes.func.isRequired,
}

export default withContentRect('bounds')(observer(App))
