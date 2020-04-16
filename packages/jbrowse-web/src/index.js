import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { FatalErrorDialog } from '@gmod/jbrowse-core/ui'
import {
  fromUrlSafeB64,
  inDevelopment,
  mergeConfigs,
} from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core/styles'
import 'core-js/stable'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import ErrorBoundary from 'react-error-boundary'
import 'requestidlecallback-polyfill'
import 'typeface-roboto'
import { StringParam, useQueryParam } from 'use-query-params'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import * as serviceWorker from './serviceWorker'

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

const useStyles = makeStyles({
  loadingIndicator: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
})

async function factoryReset() {
  localStorage.removeItem('jbrowse-web-data')
  localStorage.removeItem('jbrowse-web-session')
  window.location.reload()
}

const PlatformSpecificFatalErrorDialog = props => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}

function App() {
  const [configSnapshot, setConfigSnapshot] = useState()
  const [plugins, setPlugins] = useState()

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
        config = JSON.parse(await openLocation(configLocation).readFile('utf8'))
      } catch (error) {
        setConfigSnapshot(() => {
          throw error
        })
      }
      if (configLocation.uri === 'test_data/config.json' && inDevelopment) {
        try {
          config = mergeConfigs(
            config,
            JSON.parse(
              await openLocation({
                uri: 'test_data/config_in_dev.json',
              }).readFile('utf8'),
            ),
          )
        } catch (error) {
          setConfigSnapshot(() => {
            throw error
          })
        }
      }
      setConfigSnapshot(config)
    }
    fetchConfig()
  }, [configQueryParam])

  useEffect(() => {
    async function fetchPlugins() {
      // TODO: Runtime plugins
      // Loading runtime plugins will look something like this
      // const pluginLoader = new PluginLoader(config.plugins)
      // const runtimePlugins = await pluginLoader.load()
      // setPlugins([...corePlugins, ...runtimePlugins])
      setPlugins(corePlugins)
    }
    fetchPlugins()
  }, [])

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
      rootModel = JBrowseRootModel.create({ jbrowse: configSnapshot })
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
      })
    } catch (e) {
      console.error(e)
      const additionalMsg =
        e.message.length > 10000 ? '... see console for more' : ''
      throw new Error(e.message.slice(0, 10000) + additionalMsg)
    }
  }
  try {
    if (sessionQueryParam) {
      const savedSessionIndex = rootModel.jbrowse.savedSessionNames.indexOf(
        sessionQueryParam,
      )
      if (savedSessionIndex !== -1) {
        rootModel.setSession(rootModel.jbrowse.savedSessions[savedSessionIndex])
      } else {
        rootModel.setSession(JSON.parse(fromUrlSafeB64(sessionQueryParam)))
      }
    } else {
      const localStorageSession = localStorage.getItem('jbrowse-web-session')
      if (localStorageSession) {
        rootModel.setSession(JSON.parse(localStorageSession))
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
    throw new Error(e.message.slice(0, 10000))
  }
  // make some things available globally for testing
  // e.g. window.MODEL.views[0] in devtools
  window.MODEL = rootModel.session
  window.ROOTMODEL = rootModel
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()

  return <JBrowse pluginManager={pluginManager} />
}

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <App />
  </ErrorBoundary>,
  document.getElementById('root'),
)
