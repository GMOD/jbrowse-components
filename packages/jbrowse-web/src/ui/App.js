import CssBaseline from '@material-ui/core/CssBaseline'
import Drawer from '@material-ui/core/Drawer'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Typography from '@material-ui/core/Typography'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'
import { inject, observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import { CombineLatestSubscriber } from 'rxjs/internal/observable/combineLatest'
import Theme from './Theme'

const styles = theme => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
  drawerCloseButton: {
    margin: theme.spacing.unit,
    float: 'right',
  },
  defaultDrawer: {
    margin: theme.spacing.unit,
  },
})

@withStyles(styles)
@inject('rootModel')
@observer
class App extends Component {
  static propTypes = {
    classes: ReactPropTypes.shape({
      drawerCloseButton: ReactPropTypes.string.isRequired,
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
      const { LazyReactComponent } = getDrawerWidgetType(drawerWidget.type)
      drawerComponent = (
        <div>
          <IconButton
            className={classes.drawerCloseButton}
            aria-label="Close"
            onClick={() => rootModel.hideAllDrawerWidgets()}
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>
          <React.Suspense fallback={<div>Loading...</div>}>
            <LazyReactComponent model={drawerWidget} />
          </React.Suspense>
        </div>
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
        {rootModel.views.map(view => {
          const { ReactComponent } = getViewType(view.type)
          return <ReactComponent key={`view-${view.id}`} model={view} />
        })}
        <Drawer variant="permanent" anchor="right">
          {drawerComponent}
        </Drawer>
      </MuiThemeProvider>
    )
  }
}

export default App
