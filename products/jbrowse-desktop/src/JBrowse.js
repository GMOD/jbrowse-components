import React, { useEffect, useState, Suspense } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import { CssBaseline, ThemeProvider } from '@material-ui/core'

import electron from 'electron'
import { observer } from 'mobx-react'
import { onSnapshot, getSnapshot } from 'mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import StartScreen from './StartScreen'
import factoryReset from './factoryReset'

const { ipcRenderer } = electron

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
  return ipcRenderer.invoke('saveConfig', snapshot)
}
const JBrowse = observer(({ pluginManager }) => {
  const [firstLoad, setFirstLoad] = useState(true)

  const { rootModel } = pluginManager
  const {
    session,
    jbrowse,
    error,
    pluginsUpdated,
    isAssemblyEditing,
    setAssemblyEditing,
  } = rootModel

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
  }, [jbrowse, pluginsUpdated, rootModel])

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
      ipcRenderer.send('saveSession', snapshot)
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
  }, [session])

  if (error) {
    throw new Error(error)
  }

  const theme = getConf(jbrowse, 'theme')

  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <CssBaseline />
      {session ? (
        <>
          <App session={session} />
          <Suspense fallback={<div />}>
            <AssemblyManager
              rootModel={rootModel}
              open={isAssemblyEditing}
              onClose={() => {
                setAssemblyEditing(false)
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
