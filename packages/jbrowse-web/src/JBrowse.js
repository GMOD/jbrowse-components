import CssBaseline from '@material-ui/core/CssBaseline'
import { MuiThemeProvider } from '@material-ui/core/styles'
// Polyfill for TextDecoder
import 'fast-text-encoding'
import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import shortid from 'shortid'
import 'typeface-roboto'
import './fonts/material-icons.css'

import corePlugins from './corePlugins'
import PluginManager from './PluginManager'
import RootModelFactory from './rootModel'
import App from './ui/App'
import Theme from './ui/theme'
import { openLocation } from './util/io'

import WorkerManager from './WorkerManager'

export async function createTestEnv(configSnapshot = {}) {
  const { modelType, pluginManager } = createModelType([])
  return {
    ...(await createRootModel(modelType, configSnapshot)),
    pluginManager,
  }
}

function createModelType(workerGroups) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  const workerManager = new WorkerManager()
  workerManager.addWorkers(workerGroups)
  pluginManager.configure()
  const modelType = RootModelFactory(pluginManager, workerManager)
  return { modelType, pluginManager }
}

async function createRootModel(modelType, config) {
  let configSnapshot = config
  if (config.uri || config.localPath) {
    try {
      configSnapshot = JSON.parse(
        new TextDecoder('utf-8').decode(await openLocation(config).readFile()),
      )
    } catch (error) {
      console.error('Failed to load config ', error)
      throw error
    }
  }

  const {
    defaultSession = { menuBars: [{ type: 'MainMenuBar' }] },
  } = configSnapshot
  const {
    sessionName = `Unnamed Session ${shortid.generate()}`,
  } = defaultSession
  return {
    sessionName,
    rootModel: modelType.create({
      ...defaultSession,
      configuration: configSnapshot,
    }),
  }
}

// the main JBrowse component
class JBrowse extends React.Component {
  static propTypes = {
    configs: PropTypes.arrayOf(PropTypes.shape()),
    workerGroups: PropTypes.shape().isRequired,
  }

  static defaultProps = {
    configs: [],
  }

  state = {
    modelType: undefined,
    pluginManager: undefined,
    sessions: undefined,
    activeSession: undefined,
  }

  async componentDidMount() {
    const { configs, workerGroups } = this.props
    const { modelType, pluginManager } = createModelType(workerGroups)

    const sessions = new Map()
    let activeSession
    for (const config of configs) {
      // eslint-disable-next-line no-await-in-loop
      const { sessionName, rootModel } = await createRootModel(
        modelType,
        config,
      )
      if (!activeSession) activeSession = sessionName
      sessions.set(sessionName, rootModel)
    }

    this.setState({
      modelType,
      pluginManager,
      sessions,
      activeSession,
    })

    // poke some things for testing (this stuff will eventually be removed)
    window.getSnapshot = getSnapshot
    window.resolveIdentifier = resolveIdentifier
  }

  setSession = sessionName => {
    this.setState({ activeSession: sessionName })
  }

  addSession = async config => {
    const { modelType, sessions } = this.state
    const { sessionName, rootModel } = await createRootModel(modelType, config)
    sessions.set(sessionName, rootModel)
  }

  render() {
    const { modelType, pluginManager, sessions, activeSession } = this.state
    if (!(modelType && pluginManager && sessions && activeSession))
      return <div>loading...</div>

    // poke some things for testing (this stuff will eventually be removed)
    window.MODEL = sessions.get(activeSession)

    return (
      <MuiThemeProvider theme={Theme}>
        <CssBaseline />
        <App
          rootModel={sessions.get(activeSession)}
          getViewType={pluginManager.getViewType}
          getDrawerWidgetType={pluginManager.getDrawerWidgetType}
          getMenuBarType={pluginManager.getMenuBarType}
          sessionNames={Array.from(sessions.keys())}
          activeSession={activeSession}
          setSession={this.setSession}
        />
      </MuiThemeProvider>
    )
  }
}

export default JBrowse
