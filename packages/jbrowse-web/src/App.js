import React, { Component } from 'react'
import logo from './logo.svg'
import './App.css'
import LinearGenomeView from './ui/LinearGenomeView'

class App extends Component {
  render() {
    const blocks = [
      { refName: 'ctgA', start: 100, end: 200 },
      { refName: 'ctgA', start: 300, end: 400 },
    ]
    const tracks = [{ id: 'foo', height: 100 }, { id: 'bar', height: 30 }]
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
          offsetPx={-140}
        />
      </div>
    )
  }
}

export default App
