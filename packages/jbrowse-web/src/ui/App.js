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
  components: {
    overflowY: 'auto',
  },
  drawerCloseButton: {
    margin: theme.spacing.unit,
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
  }

  render() {
    const { classes, getDrawerWidgetType, getViewType, rootModel } = this.props
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
          <div className={classes.components}>
            {rootModel.views.map(view => {
              const { ReactComponent } = getViewType(view.type)
              return <ReactComponent key={`view-${view.id}`} model={view} />
            })}
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
