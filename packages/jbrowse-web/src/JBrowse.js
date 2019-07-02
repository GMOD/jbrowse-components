import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import shortid from 'shortid'
import 'typeface-roboto'
import '@gmod/jbrowse-core/fonts/material-icons.css'

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import corePlugins from './corePlugins'
import RootModelFactory from './rootModel'
import App from './ui/App'
import Theme from './ui/theme'

export async function createTestEnv(configSnapshot = {}) {
  const { modelType, pluginManager } = createModelType([])
  const config = {
    ...configSnapshot,
    rpc: { defaultDriver: 'MainThreadRpcDriver' },
  }
  return {
    ...(await createRootModel(modelType, config)),
    pluginManager,
  }
}

function createModelType() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.configure()
  const modelType = RootModelFactory(pluginManager)
  return { modelType, pluginManager }
}

async function createRootModel(modelType, config) {
  let configSnapshot = config
  if (config.uri || config.localPath) {
    try {
      configSnapshot = JSON.parse(await openLocation(config).readFile('utf8'))
    } catch (error) {
      console.error('Failed to load config ', error)
      throw error
    }
  }

  let { defaultSession } = configSnapshot
  if (!defaultSession) defaultSession = {}
  if (!defaultSession.menuBars)
    defaultSession.menuBars = [{ type: 'MainMenuBar' }]
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
  const [modelType, setModelType] = useState()
  const [pluginManager, setPluginManager] = useState()
  const [sessions, setSessions] = useState()
  const [activeSession, setActiveSession] = useState()

  const { configs } = props

  useEffect(() => {
    async function setup() {
      const {
        modelType: newModelType,
        pluginManager: newPluginManager,
      } = createModelType()

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

    setup()
  }, [configs])

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
    <ThemeProvider theme={Theme}>
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
    </ThemeProvider>
  )
}

JBrowse.propTypes = {
  configs: PropTypes.arrayOf(PropTypes.shape()),
}

JBrowse.defaultProps = {
  configs: [],
}

export default JBrowse
