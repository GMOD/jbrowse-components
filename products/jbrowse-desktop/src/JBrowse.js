import { getConf } from '@jbrowse/core/configuration'
import { App, StartScreen, createJBrowseTheme } from '@jbrowse/core/ui'

import CssBaseline from '@material-ui/core/CssBaseline'

import { ThemeProvider } from '@material-ui/core/styles'

import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import factoryReset from './factoryReset'

const debounceMs = 1000

// adapted from https://github.com/jashkenas/underscore/blob/5d8ab5e37c9724f6f1181c5f95d0020815e4cb77/underscore.js#L894-L925
function debounce(func, wait) {
  let timeout
  let result
  const later = (...args) => {
    timeout = null
    result = func(...args)
  }
  const debounced = (...args) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      return later(...args)
    }, wait)
    return result
  }
  debounced.cancel = () => {
    clearTimeout(timeout)
    timeout = null
  }
  return debounced
}

const JBrowse = observer(({ pluginManager }) => {
  const { electron = {} } = window
  const { desktopCapturer, ipcRenderer } = electron
  const [firstLoad, setFirstLoad] = useState(true)

  const { rootModel } = pluginManager
  const { session, jbrowse, error } = rootModel
  if (firstLoad && session) setFirstLoad(false)

  useEffect(() => {
    function sendIpcConfig(snapshot) {
      ipcRenderer.send('saveConfig', snapshot)
    }

    let disposer = () => {}
    if (jbrowse) {
      const updater = debounce(sendIpcConfig, debounceMs)
      const snapshotDisposer = onSnapshot(jbrowse, updater)
      disposer = () => {
        snapshotDisposer()
        updater.cancel()
      }
    }
    return disposer
  }, [jbrowse, ipcRenderer])

  useEffect(() => {
    async function createScreenshot(snapshot) {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 500, height: 500 },
      })
      const jbWindow = sources.find(source => source.name === 'JBrowse')
      const screenshot = jbWindow.thumbnail.toDataURL()
      ipcRenderer.send('saveSession', snapshot, screenshot)
    }

    let disposer = () => {}
    if (session) {
      const updater = debounce(createScreenshot, debounceMs)
      const snapshotDisposer = onSnapshot(session, updater)
      disposer = () => {
        snapshotDisposer()
        updater.cancel()
      }
    }
    return disposer
  }, [session, desktopCapturer, ipcRenderer])

  if (error) {
    throw new Error(error)
  }

  const theme = getConf(rootModel.jbrowse, 'theme')
  const { AssemblyManager } = pluginManager.getPlugin(
    'DataManagementPlugin',
  ).exports

  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <CssBaseline />
      {rootModel.session ? (
        <>
          <App session={rootModel.session} />
          <AssemblyManager
            rootModel={rootModel}
            open={rootModel.isAssemblyEditing}
            onClose={() => {
              rootModel.setAssemblyEditing(false)
            }}
          />
        </>
      ) : (
        <StartScreen
          root={rootModel}
          bypass={firstLoad}
          onFactoryReset={factoryReset}
        />
      )}
    </ThemeProvider>
  )
})

export default JBrowse
