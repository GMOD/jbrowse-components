import CssBaseline from '@material-ui/core/CssBaseline'
import Drawer from '@material-ui/core/Drawer'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'
import { inject, observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import Theme from './Theme'

const drawerWidth = Theme.overrides.MuiDrawer.paper.width
const appBarHeight = Theme.overrides.MuiToolbar.root.height

const styles = {
  drawer: {
    width: drawerWidth,
  },
  main: {
    width: `calc(100% - ${drawerWidth})`,
  },
  views: {
    'overflow-y': 'auto',
    height: `calc(100vh - ${appBarHeight})`,
  },
}

@inject('rootModel')
@observer
class App extends Component {
  static propTypes = {
    getViewType: ReactPropTypes.func.isRequired,
    getUiType: ReactPropTypes.func.isRequired,
    classes: ReactPropTypes.shape({
      drawer: ReactPropTypes.string.isRequired,
      main: ReactPropTypes.string.isRequired,
      views: ReactPropTypes.string.isRequired,
    }).isRequired,
  }

  static wrappedComponent = {
    propTypes: {
      rootModel: PropTypes.observableObject.isRequired,
    },
  }

  render() {
    const { classes, rootModel, getUiType, getViewType } = this.props
    let tempUiPlaceholder
    if (rootModel.tempUi) {
      const TempComponent = React.lazy(() => import(`../${rootModel.tempUi}`))
      tempUiPlaceholder = (
        <React.Suspense fallback={<div />}>
          <TempComponent onClose={() => rootModel.removeTempUi()} />
        </React.Suspense>
      )
    }
    return (
      <MuiThemeProvider theme={Theme}>
        <CssBaseline />
        <main className={classes.main}>
          {rootModel.uis.map(ui => {
            const { ReactComponent } = getUiType(ui.type)
            return <ReactComponent key={`ui-${ui.id}`} model={ui} />
          })}
          {tempUiPlaceholder}
          <div className={classes.views}>
            {rootModel.views.map(view => {
              const { ReactComponent } = getViewType(view.type)
              return <ReactComponent key={`view-${view.id}`} model={view} />
            })}
          </div>
        </main>
        <Drawer
          variant="permanent"
          anchor="right"
          className={classes.drawer}
          classes={{
            paper: classes.drawer,
          }}
        >
          {/* TODO: put content in drawer */}
        </Drawer>
      </MuiThemeProvider>
    )
  }
}

export default withStyles(styles)(App)
