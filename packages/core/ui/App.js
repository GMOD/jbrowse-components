import { makeStyles } from '@material-ui/core/styles'

import { observer, PropTypes } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useRef } from 'react'
import { withContentRect } from 'react-measure'

import { inDevelopment } from '../util'
import DrawerWidget from './DrawerWidget'
import DevTools from './DevTools'
import Snackbar from './Snackbar'

const useStyles = makeStyles(theme => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
  root: {
    display: 'grid',
    height: '100vh',
    width: '100%',
  },
  menuBarsAndComponents: {
    gridColumn: 'main',
    display: 'grid',
    gridTemplateRows: '[menubars] min-content [components] auto',
    height: '100vh',
  },
  menuBars: {
    gridRow: 'menubars',
  },
  components: {
    background: theme.palette.background.mainApp,
    overflowY: 'auto',
    gridRow: 'components',
  },
  viewContainer: { marginTop: 8 },
}))

function ViewContainer({ session, view }) {
  const { pluginManager } = session
  const classes = useStyles()
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType
  const containerNodeRef = useRef()

  // scroll the view into view when first mounted
  // note that this effect will run only once, because of
  // the empty array second param
  useEffect(() => {
    if (containerNodeRef.current.scrollIntoView)
      containerNodeRef.current.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div ref={containerNodeRef} className={classes.viewContainer}>
      <ReactComponent
        model={view}
        session={session}
        getTrackType={pluginManager.getTrackType}
      />
    </div>
  )
}

ViewContainer.propTypes = {
  session: PropTypes.observableObject.isRequired,
  view: PropTypes.objectOrObservableObject.isRequired,
}

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

  const { visibleDrawerWidget, viewsWidth, drawerWidth } = session

  return (
    <div
      ref={measureRef}
      className={classes.root}
      style={{
        gridTemplateColumns: `[main] ${viewsWidth}px${
          visibleDrawerWidget ? ` [drawer] ${drawerWidth}px` : ''
        }`,
      }}
    >
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
          {session.views.map(view => (
            <ViewContainer
              key={`view-${view.id}`}
              session={session}
              view={view}
            />
          ))}
          {inDevelopment ? <DevTools session={session} /> : null}
          <div style={{ height: 300 }} />
        </div>
      </div>

      {visibleDrawerWidget ? <DrawerWidget session={session} /> : null}
      {session.snackbarMessage ? <Snackbar session={session} /> : null}
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
