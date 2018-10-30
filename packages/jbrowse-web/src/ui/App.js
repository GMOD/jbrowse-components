import React, { Component } from 'react'
import { observer, inject, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import './App.css'

@observer
class App extends Component {
  static propTypes = {
    rootModel: PropTypes.observableObject.isRequired,
    getViewType: ReactPropTypes.func.isRequired,
  }

  render() {
    return (
      <div className="App">
        {/* <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header> */}
        {this.props.rootModel.views.map(view => {
          const { ReactComponent } = this.props.getViewType(view.type)
          return <ReactComponent key={`view-${view.id}`} model={view} />
        })}
      </div>
    )
  }
}

export default observer(props => <App {...props} />)
