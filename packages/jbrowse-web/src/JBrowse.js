import CssBaseline from '@material-ui/core/CssBaseline'
import { MuiThemeProvider } from '@material-ui/core/styles'
// Polyfill for TextDecoder
import 'fast-text-encoding'
import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
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
function JBrowse(props) {
  const [modelType, setModelType] = useState(undefined)
  const [pluginManager, setPluginManager] = useState(undefined)
  const [sessions, setSessions] = useState(undefined)
  const [activeSession, setActiveSession] = useState(undefined)

  const { configs, workerGroups } = props

  useEffect(() => {
    setup()
  }, [])

  async function setup() {
    const {
      modelType: newModelType,
      pluginManager: newPluginManager,
    } = createModelType(workerGroups)

    const newSessions = new Map()
    let newActiveSession
    for (const config of configs) {
      // eslint-disable-next-line no-await-in-loop
      const { sessionName, rootModel } = await createRootModel(
        newModelType,
        config,
      )
      if (!newActiveSession) newActiveSession = sessionName
      newSessions.set(sessionName, rootModel)
    }

    setModelType(newModelType)
    setPluginManager(newPluginManager)
    setSessions(newSessions)
    setActiveSession(newActiveSession)

    // poke some things for testing (this stuff will eventually be removed)
    window.getSnapshot = getSnapshot
    window.resolveIdentifier = resolveIdentifier
  }

  /**
   *
   * @param {Object[]} newConfigs An array of config objects
   */
  async function addSessions(newConfigs) {
    const newSessions = new Map()
    for (const config of newConfigs) {
      // eslint-disable-next-line no-await-in-loop
      const { sessionName, rootModel } = await createRootModel(
        modelType,
        config,
      )
      newSessions.set(sessionName, rootModel)
    }
    setSessions(new Map([...sessions, ...newSessions]))
  }

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
        setActiveSession={setActiveSession}
        addSessions={addSessions}
      />
    </MuiThemeProvider>
  )
}

JBrowse.propTypes = {
  configs: PropTypes.arrayOf(PropTypes.shape()),
  workerGroups: PropTypes.shape().isRequired,
}

JBrowse.defaultProps = {
  configs: [],
}

export default JBrowse
