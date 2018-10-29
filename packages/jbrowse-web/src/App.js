import React, { Component } from 'react'
import { observer, inject, PropTypes } from 'mobx-react'
import LinearGenomeView from './ui/LinearGenomeView/LinearGenomeView'

import './App.css'
import logo from './logo.svg'

@inject('rootModel')
@observer
class App extends Component {
  static propTypes = {
    rootModel: PropTypes.observableObject.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = { offset: 0, width: 800, controlsWidth: 100 }

    // bind event methods
    this.horizontalScroll = this.horizontalScroll.bind(this)
  }

  calculateBlockWidths(blocks, bpPerPx) {
    let total = 0
    blocks.forEach(block => {
      block.width = Math.abs(block.end - block.start) / bpPerPx
      total += block.width
    })
    this.totalBlockWidth = total
  }

  horizontalScroll(pixels) {
    const { offset, width, controlsWidth } = this.state

    this.setState({
      offset: Math.min(
        Math.max(offset + pixels, 0),
        width - this.totalBlockWidth - controlsWidth,
      ),
    })
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
          if (view.type === 'linear') {
            return <LinearGenomeView key={`view-${view.id}`} model={view} />
          }
          throw new Error(`unsupported view type "${view.type}"`)
        })}
      </div>
    )
  }
}

export default observer(props => <App {...props} />)
