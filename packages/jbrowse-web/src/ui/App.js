import AppBar from '@material-ui/core/AppBar'
import CssBaseline from '@material-ui/core/CssBaseline'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper'
import Slide from '@material-ui/core/Slide'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'

import { inject, observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import { getSnapshot } from 'mobx-state-tree'

import DrawerResizeHandle from './DrawerResizeHandle'
import Theme from './Theme'

const styles = theme => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
  root: {
    height: '100vh',
    display: 'flex',
  },
  menuBars: {
    marginBottom: theme.spacing.unit,
  },
  menuBarsAndComponents: {
    display: 'flex',
    flexDirection: 'column',
  },
  components: {
    overflowY: 'auto',
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
})

@withStyles(styles)
@inject('rootModel')
@observer
class App extends Component {
  static propTypes = {
    classes: ReactPropTypes.shape({
      root: ReactPropTypes.string.isRequired,
      components: ReactPropTypes.string.isRequired,
      drawerCloseButton: ReactPropTypes.string.isRequired,
      defaultDrawer: ReactPropTypes.string.isRequired,
      drawerToolbar: ReactPropTypes.string.isRequired,
      drawerToolbarCloseButton: ReactPropTypes.string.isRequired,
    }).isRequired,
    rootModel: PropTypes.observableObject.isRequired,
    getViewType: ReactPropTypes.func.isRequired,
    getDrawerWidgetType: ReactPropTypes.func.isRequired,
    getMenuBarType: ReactPropTypes.func.isRequired,
  }

  constructor(props) {
    super(props)
    const { rootModel } = this.props
    window.addEventListener('resize', () => rootModel.updateWindowWidth())
  }

  render() {
    const {
      classes,
      getDrawerWidgetType,
      getViewType,
      getMenuBarType,
      rootModel,
    } = this.props
    const drawerWidget = rootModel.selectedDrawerWidget
    let drawerComponent
    if (drawerWidget) {
      const { LazyReactComponent, heading } = getDrawerWidgetType(
        drawerWidget.type,
      )
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
                  {heading || ''}
                </Typography>
                <div className={classes.drawerToolbarCloseButton} />
                <IconButton
                  className={classes.drawerCloseButton}
                  color="inherit"
                  aria-label="Close"
                  onClick={() => rootModel.hideAllDrawerWidgets()}
                >
                  <Icon fontSize="small">close</Icon>
                </IconButton>
              </Toolbar>
            </AppBar>
            <React.Suspense fallback={<div>Loading...</div>}>
              <LazyReactComponent model={drawerWidget} />
            </React.Suspense>
          </div>
        </Slide>
      )
    } else {
      drawerComponent = (
        <div className={classes.defaultDrawer}>
          <Typography variant="h5">Welcome to JBrowse!</Typography>
          <Typography>
            Click on &quot;select tracks&quot; in a view to open the track
            selector for that view here.
          </Typography>
        </div>
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
            <div className={classes.components}>
              {rootModel.views.map(view => {
                const { ReactComponent } = getViewType(view.type)
                return <ReactComponent key={`view-${view.id}`} model={view} />
              })}
              <button
                type="button"
                onClick={() =>
                  rootModel.addView('LinearGenomeView', {
                    displayedRegions: getSnapshot(
                      rootModel.views[0].displayedRegions,
                    ),
                  })
                }
              >
                Add linear view
              </button>
            </div>
          </div>
          <DrawerResizeHandle
            onHorizontalDrag={distance => rootModel.resizeDrawer(distance)}
          />
          <Paper
            className={classes.components}
            style={{
              width: rootModel.drawerWidth,
            }}
          >
            {drawerComponent}
          </Paper>
        </div>
      </MuiThemeProvider>
    )
  }
}

export default App
