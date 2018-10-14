import React from 'react'
import { MuiThemeProvider } from '@material-ui/core/styles'
import logo from './logo.svg'
import HierarchicalTrackSelector from './ui/HierarchicalTrackSelector'
import MainAppBar from './ui/MainAppBar'
import SideDrawer from './ui/SideDrawer'
import Theme from './ui/Theme'
import { MenuConfig } from './ui/ConfigTemp'
import './App.css'

function App() {
  const style = {
    width: `calc(100% - ${350}px)`,
  }
  return (
    <MuiThemeProvider theme={Theme}>
      <div className="App">
        <MainAppBar menus={MenuConfig} style={style} />
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
        <SideDrawer>
          <HierarchicalTrackSelector />
        </SideDrawer>
      </div>
    </MuiThemeProvider>
  )
}

export default App
