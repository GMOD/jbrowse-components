// Polyfill for TextDecoder
import 'fast-text-encoding'
import React from 'react'
import PropTypes from 'prop-types'
import { Provider } from 'mobx-react'
import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import CssBaseline from '@material-ui/core/CssBaseline'
import { MuiThemeProvider } from '@material-ui/core/styles'
import shortid from 'shortid'
import 'typeface-roboto'
import './fonts/material-icons.css'

import Theme from './ui/theme'

import PluginManager from './PluginManager'
import corePlugins from './corePlugins'
import { openLocation } from './util/io'

import App from './ui/App'
import RootModelFactory from './rootModel'

import WorkerManager from './WorkerManager'

// the main class used to configure and start a new JBrowse app
class JBrowse extends React.Component {
  static propTypes = {
    configs: PropTypes.arrayOf(PropTypes.shape()),
    workerGroups: PropTypes.shape().isRequired,
  }

  static defaultProps = {
    configs: [],
  }

  state = {
    pluginManager: undefined,
    workerManager: undefined,
    modelType: undefined,
    sessions: undefined,
    activeSession: undefined,
    configured: false,
  }

  async componentDidMount() {
    const { configs, workerGroups } = this.props
    const pluginManager = new PluginManager(corePlugins)
    const workerManager = new WorkerManager()
    workerManager.addWorkers(workerGroups)
    pluginManager.configure()
    const modelType = RootModelFactory(pluginManager, workerManager)

    const sessions = new Map()
    let activeSession
    for (const config of configs) {
      let configSnapshot
      if (config.uri || config.localPath) {
        try {
          configSnapshot = JSON.parse(
            new TextDecoder('utf-8').decode(
              // eslint-disable-next-line no-await-in-loop
              await openLocation(config).readFile(),
            ),
          )
        } catch (error) {
          console.error('Failed to load config ', error)
          throw error
        }
      } else configSnapshot = config

      const {
        defaultSession = { menuBars: [{ type: 'MainMenuBar' }] },
      } = configSnapshot
      const {
        sessionName = `Unnamed Session ${shortid.generate()}`,
      } = defaultSession
      if (!activeSession) activeSession = sessionName
      sessions.set(
        sessionName,
        modelType.create({
          ...defaultSession,
          configuration: configSnapshot,
        }),
      )

      const configured = true
      this.setState({
        pluginManager,
        workerManager,
        modelType,
        sessions,
        activeSession,
        configured,
      })

      // poke some things for testing (this stuff will eventually be removed)
      window.getSnapshot = getSnapshot
      window.resolveIdentifier = resolveIdentifier
    }
  }

  setSession = sessionName => {
    this.setState({ activeSession: sessionName })
  }

  addPlugin(plugin) {
    // just delegates to the plugin manager
    this.pluginManager.addPlugin(plugin)
    return this
  }

  render() {
    const {
      pluginManager,
      workerManager,
      modelType,
      sessions,
      activeSession,
      configured,
    } = this.state
    if (
      !(
        pluginManager &&
        workerManager &&
        modelType &&
        sessions &&
        activeSession &&
        configured
      )
    )
      return <div>loading...</div>

    // poke some things for testing (this stuff will eventually be removed)
    window.MODEL = sessions.get(activeSession)

    return (
      <Provider rootModel={sessions.get(activeSession)}>
        <MuiThemeProvider theme={Theme}>
          <CssBaseline />
          <App
            getViewType={pluginManager.getViewType}
            getDrawerWidgetType={pluginManager.getDrawerWidgetType}
            getMenuBarType={pluginManager.getMenuBarType}
            sessionNames={Array.from(sessions.keys())}
            activeSession={activeSession}
            setSession={this.setSession}
          />
        </MuiThemeProvider>
      </Provider>
    )
  }
}

export default JBrowse
