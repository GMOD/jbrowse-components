import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { FatalErrorDialog } from '@gmod/jbrowse-core/ui'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core/styles'
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import ErrorBoundary from 'react-error-boundary'
import 'typeface-roboto'
import factoryReset from './factoryReset'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'

const { electron } = window
const { ipcRenderer, remote } = electron
const { BrowserWindow, getCurrentWindow } = remote

window.onbeforeunload = () => {
  const thisWindowId = getCurrentWindow().id
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.id !== thisWindowId) win.close()
  })
}

ipcRenderer.on('consoleLog', async (event, ...args) => {
  // eslint-disable-next-line no-console
  console.log(`windowWorker-${event.senderId}-log`, ...args)
})

ipcRenderer.on('consoleWarn', async (event, ...args) => {
  console.warn(`windowWorker-${event.senderId}-warn`, ...args)
})

ipcRenderer.on('consoleError', async (event, ...args) => {
  console.error(`windowWorker-${event.senderId}-error`, ...args)
})

const useStyles = makeStyles({
  loadingIndicator: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
})

const PlatformSpecificFatalErrorDialog = props => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}

function App() {
  const [configSnapshot, setConfigSnapshot] = useState()
  const [plugins, setPlugins] = useState()

  const classes = useStyles()

  useEffect(() => {
    async function fetchConfig() {
      try {
        setConfigSnapshot(
          Object.assign(await ipcRenderer.invoke('loadConfig'), {
            configuration: { rpc: { defaultDriver: 'ElectronRpcDriver' } },
          }),
        )
      } catch (error) {
        setConfigSnapshot(() => {
          throw error
        })
      }
    }

    fetchConfig()
  }, [])

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
  } catch (e) {
    console.error(e)
    const additionalMsg =
      e.message.length > 10000 ? '... see console for more' : ''
    throw new Error(e.message.slice(0, 10000) + additionalMsg)
  }

  // make some things available globally for testing
  // e.g. window.MODEL.views[0] in devtools
  window.MODEL = rootModel.session
  window.ROOTMODEL = rootModel
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()

  return <JBrowse pluginManager={pluginManager} />
}

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <App />
  </ErrorBoundary>,
  document.getElementById('root'),
)
