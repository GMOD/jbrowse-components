import React, { Component } from 'react'
import { observer, inject, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'
import Drawer from '@material-ui/core/Drawer'

import CssBaseline from '@material-ui/core/CssBaseline'

import Theme from './Theme'

const styles = {
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
}

@withStyles(styles)
@inject('rootModel')
@observer
class App extends Component {
  static propTypes = {
    rootModel: PropTypes.observableObject.isRequired,
    getViewType: ReactPropTypes.func.isRequired,
    getDrawerWidgetType: ReactPropTypes.func.isRequired,
  }

  render() {
    return (
      <MuiThemeProvider theme={Theme}>
        <CssBaseline />
        {this.props.rootModel.views.map(view => {
          const { ReactComponent } = this.props.getViewType(view.type)
          return <ReactComponent key={`view-${view.id}`} model={view} />
        })}
        <Drawer variant="permanent" anchor="right">
          {this.props.rootModel.drawerWidgets.map(drawerWidget => {
            const { ReactComponent } = this.props.getDrawerWidgetType(
              drawerWidget.type,
            )
            return (
              <ReactComponent
                key={`view-${drawerWidget.id}`}
                model={drawerWidget}
              />
            )
          })}
        </Drawer>
      </MuiThemeProvider>
    )
  }
}

export default App
