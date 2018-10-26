import React from 'react'
import PropTypes from 'prop-types'
import { MuiThemeProvider, withStyles } from '@material-ui/core/styles'
import logo from './logo.svg'
import HierarchicalTrackSelector from './ui/HierarchicalTrackSelector'
import MainAppBar from './ui/MainAppBar'
import SideDrawer from './ui/SideDrawer'
import Theme from './ui/Theme'
import { DrawerConfig, MenuConfig, TrackConfig } from './ui/ConfigTemp'
import './App.css'

const styles = {
  root: {
    width: DrawerConfig.width,
  },
}

function App(props) {
  const { classes } = props

  const width = Number.isInteger(styles.root.width)
    ? `${styles.root.width}px`
    : styles.root.width

  const style = {
    width: `calc(100% - ${width})`,
  }

  return (
    <MuiThemeProvider theme={Theme}>
      <div className="App">
        <div style={style}>
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
        <SideDrawer className={classes.root}>
          <HierarchicalTrackSelector config={TrackConfig} />
        </SideDrawer>
      </div>
    </MuiThemeProvider>
  )
}

App.propTypes = {
  classes: PropTypes.shape().isRequired,
}

export default withStyles(styles)(App)
