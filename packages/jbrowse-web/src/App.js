import React, { Component } from 'react'
import logo from './logo.svg'
import './App.css'
import LinearGenomeView from './ui/LinearGenomeView/LinearGenomeView'

class App extends Component {
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
    const bpPerPx = 1
    const blocks = [
      { refName: 'ctgA', start: 0, end: 50, content: 'bar' },
      { refName: 'ctgA', start: 100, end: 200, content: 'foo' },
      {
        refName: 'ctgA',
        start: 300,
        end: 400,
        content: (
          <div
            style={{
              color: 'red',
              top: '10px',
              left: '30px',
              position: 'absolute',
            }}
          >
            hihi
          </div>
        ),
      },
    ]
    this.calculateBlockWidths(blocks, bpPerPx)
    const tracks = [{ id: 'foo', height: 100 }, { id: 'bar', height: 30 }]
    const { offset, width, controlsWidth } = this.state
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
        <LinearGenomeView
          blocks={blocks}
          width={width}
          tracks={tracks}
          bpPerPx={bpPerPx}
          offsetPx={offset}
          onHorizontalScroll={this.horizontalScroll}
          controlsWidth={controlsWidth}
        />
      </div>
    )
  }
}

export default App
