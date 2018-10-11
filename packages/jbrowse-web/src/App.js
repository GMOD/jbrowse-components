import React from 'react'
import { MuiThemeProvider } from '@material-ui/core/styles'
import logo from './logo.svg'
import MainAppBar from './ui/MainAppBar'
import MenuConfig from './ui/MenuConfigTemp'
import Theme from './ui/Theme'
import './App.css'

function App() {
  return (
    <MuiThemeProvider theme={Theme}>
      <div className="App">
        <MainAppBar menus={MenuConfig} />
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
      </div>
    </MuiThemeProvider>
  )
}

export default App
