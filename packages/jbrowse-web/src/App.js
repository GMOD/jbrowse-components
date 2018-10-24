import React, { Component } from 'react'
import logo from './logo.svg'
import './App.css'
import LinearGenomeView from './ui/LinearGenomeView/LinearGenomeView'

class App extends Component {
  constructor(props) {
    super(props)
    this.state = { offset: 0 }

    // bind event methods
    this.horizontalScroll = this.horizontalScroll.bind(this)
  }

  horizontalScroll(pixels, event) {
    const { offset } = this.state
    this.setState({ offset: offset + pixels })
  }

  render() {
    const blocks = [
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
    const tracks = [{ id: 'foo', height: 100 }, { id: 'bar', height: 30 }]
    const { offset } = this.state
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
          width={800}
          tracks={tracks}
          bpPerPx={1}
          offsetPx={offset}
          onHorizontalScroll={this.horizontalScroll}
        />
      </div>
    )
  }
}

export default App
