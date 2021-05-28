import React, { useEffect, useState, Suspense } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import { CssBaseline, ThemeProvider } from '@material-ui/core'

import { observer } from 'mobx-react'
import { onSnapshot, getSnapshot } from 'mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import StartScreen from './StartScreen'
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
function saveConfig(snapshot) {
  const { electron = {} } = window
  return electron.ipcRenderer.invoke('saveConfig', snapshot)
}
const JBrowse = observer(({ pluginManager }) => {
  const { electron = {} } = window
  const { desktopCapturer, ipcRenderer } = electron
  const [firstLoad, setFirstLoad] = useState(true)

  const { rootModel } = pluginManager
  const { session, jbrowse, error, pluginsUpdated } = rootModel

  if (firstLoad && session) {
    setFirstLoad(false)
  }

  useEffect(() => {
    if (jbrowse) {
      const updater = debounce(saveConfig, debounceMs)
      const snapshotDisposer = onSnapshot(jbrowse, updater)
      return () => {
        snapshotDisposer()
        updater.cancel()
      }
    }
    return () => {}
  }, [jbrowse, ipcRenderer, pluginsUpdated, rootModel])

  useEffect(() => {
    ;(async () => {
      if (pluginsUpdated) {
        await saveConfig(getSnapshot(jbrowse))
        window.location.reload()
      }
    })()
  }, [pluginsUpdated, jbrowse])

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

  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <CssBaseline />
      {rootModel.session ? (
        <>
          <App session={rootModel.session} />
          <Suspense fallback={<div />}>
            <AssemblyManager
              rootModel={rootModel}
              open={rootModel.isAssemblyEditing}
              onClose={() => {
                rootModel.setAssemblyEditing(false)
              }}
            />
          </Suspense>
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
