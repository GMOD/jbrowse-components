import { makeStyles } from '@material-ui/core/styles'

import { observer, PropTypes } from 'mobx-react'
import React from 'react'

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

function App({ session }) {
  const classes = useStyles()
  const { pluginManager } = session

  const { visibleDrawerWidget, drawerWidth } = session

  return (
    <div
      className={classes.root}
      style={{
        gridTemplateColumns: `[main] 1fr${
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
}

export default observer(App)
