import AppBar from '@material-ui/core/AppBar'
import CssBaseline from '@material-ui/core/CssBaseline'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slide from '@material-ui/core/Slide'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'

import { inject, observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import { getSnapshot } from 'mobx-state-tree'
import { withSize } from 'react-sizeme'
import { Scrollbars } from 'react-custom-scrollbars'

import Theme from './Theme'
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
  },
  menuBars: {
    marginBottom: theme.spacing.unit,
  },
  menuBarsAndComponents: {
    display: 'flex',
    flexDirection: 'column',
  },
  components: {
    backgroundColor: theme.palette.background.default,
  },
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
})

@withStyles(styles)
@inject('rootModel')
@observer
class App extends Component {
  static propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    rootModel: PropTypes.observableObject.isRequired,
    getViewType: ReactPropTypes.func.isRequired,
    getDrawerWidgetType: ReactPropTypes.func.isRequired,
    getMenuBarType: ReactPropTypes.func.isRequired,
    size: ReactPropTypes.objectOf(ReactPropTypes.number).isRequired,
  }

  componentDidMount() {
    const { rootModel, size } = this.props
    rootModel.updateWidth(size.width)
  }

  componentDidUpdate() {
    const { rootModel, size } = this.props
    rootModel.updateWidth(size.width)
  }

  render() {
    const {
      classes,
      getDrawerWidgetType,
      getViewType,
      getMenuBarType,
      rootModel,
    } = this.props
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
              <LazyReactComponent model={activeDrawerWidget} />
            </React.Suspense>
          </div>
        </Slide>
      )
    }

    return (
      <MuiThemeProvider theme={Theme}>
        <CssBaseline />
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
              <button
                type="button"
                onClick={() =>
                  rootModel.addView(
                    'LinearGenomeView',
                    {},
                    {
                      displayedRegions: getSnapshot(
                        rootModel.views[0].displayedRegions,
                      ),
                    },
                  )
                }
              >
                Add linear view
              </button>
            </Scrollbars>
          </div>
        </div>
        <Drawer open={Boolean(rootModel.activeDrawerWidgets.size)}>
          {drawerComponent}
        </Drawer>
      </MuiThemeProvider>
    )
  }
}

export default withSize()(App)
