import PluginManager from '@gmod/jbrowse-core/PluginManager'
import PluginLoader from '@gmod/jbrowse-core/PluginLoader'
import { fromUrlSafeB64 } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core/styles'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import { StringParam, useQueryParam } from 'use-query-params'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { SnapshotOut } from 'mobx-state-tree'
import { PluginConstructor } from '@gmod/jbrowse-core/Plugin'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'

const useStyles = makeStyles({
  loadingIndicator: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
})

export default function Loader() {
  const [configSnapshot, setConfigSnapshot] = useState<
    SnapshotOut<AnyConfigurationModel>
  >()
  const [plugins, setPlugins] = useState<PluginConstructor[]>()

  const [configQueryParam] = useQueryParam('config', StringParam)
  const [sessionQueryParam] = useQueryParam('session', StringParam)

  const classes = useStyles()

  useEffect(() => {
    async function fetchConfig() {
      const configLocation = {
        uri: configQueryParam || 'test_data/config.json',
      }
      let config
      try {
        config = JSON.parse(
          (await openLocation(configLocation).readFile('utf8')) as string,
        )
      } catch (error) {
        setConfigSnapshot(() => {
          throw error
        })
      }
      setConfigSnapshot(config)
    }
    fetchConfig()
  }, [configQueryParam])

  useEffect(() => {
    async function fetchPlugins() {
      // Load runtime plugins
      if (configSnapshot) {
        const pluginLoader = new PluginLoader(configSnapshot.plugins)
        const runtimePlugins = await pluginLoader.load()
        setPlugins([...corePlugins, ...runtimePlugins])
      }
    }
    fetchPlugins()
  }, [configSnapshot])

  if (!(configSnapshot && plugins)) {
    return (
      <CircularProgress
        disableShrink
        className={classes.loadingIndicator}
        size={50}
      />
    )
  }

  const pluginManager = new PluginManager(plugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager)
  let rootModel
  try {
    if (configSnapshot) {
      rootModel = JBrowseRootModel.create({
        jbrowse: configSnapshot,
        assemblyManager: {},
      })
    }
  } catch (error) {
    // if it failed to load, it's probably a problem with the saved sessions,
    // so just delete them and try again
    try {
      console.error(error)
      console.warn(
        'deleting saved sessions and re-trying after receiving the above error',
      )
      rootModel = JBrowseRootModel.create({
        jbrowse: { ...configSnapshot, savedSessions: [] },
        assemblyManager: {},
      })
    } catch (e) {
      console.error(e)
      const additionalMsg =
        e.message.length > 10000 ? '... see console for more' : ''
      throw new Error(e.message.slice(0, 10000) + additionalMsg)
    }
  }
  if (!rootModel) {
    throw new Error('could not instantiate root model')
  }
  try {
    if (sessionQueryParam) {
      const savedSessionIndex = rootModel.jbrowse.savedSessionNames.indexOf(
        sessionQueryParam,
      )
      if (getConf(rootModel.jbrowse, 'useUrlSession')) {
        if (savedSessionIndex !== -1) {
          rootModel.setSession(
            rootModel.jbrowse.savedSessions[savedSessionIndex],
          )
        } else {
          rootModel.setSession(JSON.parse(fromUrlSafeB64(sessionQueryParam)))
        }
      }
    } else {
      const localStorageSession = localStorage.getItem('jbrowse-web-session')
      if (localStorageSession) {
        if (getConf(rootModel.jbrowse, 'useLocalStorage')) {
          rootModel.setSession(JSON.parse(localStorageSession))
        }
      }
    }
    if (!rootModel.session) {
      if (rootModel.jbrowse && rootModel.jbrowse.savedSessions.length) {
        const { name } = rootModel.jbrowse.savedSessions[0]
        rootModel.activateSession(name)
      } else {
        rootModel.setDefaultSession()
      }
    }

    rootModel.setHistory(
      UndoManager.create({}, { targetStore: rootModel.session }),
    )
  } catch (e) {
    console.error(e)
    if (e.message) {
      throw new Error(e.message.slice(0, 10000))
    } else {
      throw e
    }
  }
  // make some things available globally for testing
  // e.g. window.MODEL.views[0] in devtools
  // @ts-ignore
  window.MODEL = rootModel.session
  // @ts-ignore
  window.ROOTMODEL = rootModel
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()

  return <JBrowse pluginManager={pluginManager} />
}
