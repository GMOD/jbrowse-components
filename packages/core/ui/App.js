import { makeStyles, useTheme } from '@material-ui/core/styles'

import { observer, PropTypes } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useEffect } from 'react'
import { withContentRect } from 'react-measure'

import DrawerWidget from './DrawerWidget'
import Snackbar from './Snackbar'
import ViewContainer from './ViewContainer'

const useStyles = makeStyles({
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
    overflowY: 'auto',
    gridRow: 'components',
  },
})

function App({ contentRect, measureRef, session }) {
  const theme = useTheme()
  const margin = theme.spacing(1)
  const classes = useStyles()
  const { pluginManager } = session
  const { width } = contentRect.bounds
  useEffect(() => {
    if (width) {
      if (isAlive(session)) {
        session.updateWidth(width, margin * 2)
      }
    }
  }, [session, width, margin])

  const { visibleDrawerWidget, appWidth, drawerWidth } = session

  return (
    <div
      ref={measureRef}
      className={classes.root}
      style={{
        gridTemplateColumns: `[main] ${appWidth}px${
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
          {session.views.map(view => {
            const viewType = pluginManager.getViewType(view.type)
            if (!viewType) {
              throw new Error(`unknown view type ${view.type}`)
            }
            const { ReactComponent } = viewType
            return (
              <ViewContainer
                key={`view-${view.id}`}
                view={view}
                onClose={() => session.removeView(view)}
                style={{
                  margin,
                  paddingLeft: margin,
                  paddingRight: margin,
                  paddingBottom: margin,
                }}
              >
                <ReactComponent
                  model={view}
                  session={session}
                  getTrackType={pluginManager.getTrackType}
                />
              </ViewContainer>
            )
          })}
          <div style={{ height: 300 }} />
        </div>
      </div>

      {visibleDrawerWidget ? <DrawerWidget session={session} /> : null}
      <Snackbar session={session} />
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
