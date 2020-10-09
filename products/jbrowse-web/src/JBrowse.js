import { getConf } from '@gmod/jbrowse-core/configuration'
import { App, createJBrowseTheme } from '@gmod/jbrowse-core/ui'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import { StringParam, useQueryParam } from 'use-query-params'
import React, { useEffect } from 'react'

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
  const [sessionId] = useQueryParam('session', StringParam)
  const [adminKeyParam] = useQueryParam('adminKey', StringParam)
  const adminMode = adminKeyParam !== undefined

  const { rootModel } = pluginManager
  const { session, error } = rootModel || {}

  // updates the session or local storage sessions + autosave
  useEffect(() => {
    function updateLocalSession(snapshot) {
      if (
        sessionId?.startsWith('local-') &&
        sessionStorage.getItem(sessionId)
      ) {
        sessionStorage.setItem(sessionId, JSON.stringify(snapshot))
        localStorage.setItem('autosave', JSON.stringify(snapshot))
      } else if (sessionId?.startsWith('localSaved-')) {
        localStorage.setItem(sessionId, JSON.stringify(snapshot))
        if (localStorage.getItem('autosave')) {
          localStorage.removeItem('autosave')
        }
      }
    }

    let disposer = () => {}
    if (session) {
      const updater = debounce(updateLocalSession, 400)
      const snapshotDisposer = onSnapshot(session, updater)
      disposer = () => {
        snapshotDisposer()
        updater.cancel()
      }
    }
    return disposer
  }, [session, sessionId])

  useEffect(() => {
    onSnapshot(rootModel, async snapshot => {
      if (adminMode) {
        const payload = { adminKey: adminKeyParam, config: snapshot.jbrowse }
        const response = await fetch('/updateConfig', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const message = await response.text()
          rootModel.session.notify(
            `Admin server error: ${response.status} (${response.statusText}) ${
              message || ''
            }`,
          )
        }
      }
    })
  }, [rootModel, adminMode, adminKeyParam])

  if (error) {
    throw new Error(error)
  }

  const theme = getConf(rootModel.jbrowse, 'theme')
  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <CssBaseline />
      <App session={rootModel.session} />
    </ThemeProvider>
  )
})

export default JBrowse
