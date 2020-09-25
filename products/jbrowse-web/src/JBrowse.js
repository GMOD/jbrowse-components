import { App, theme } from '@gmod/jbrowse-core/ui'
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

  const { rootModel } = pluginManager
  const { session, error } = rootModel || {}

  useEffect(() => {
    function updateLocalSession(snapshot) {
      // TODOSESSION have warning when reaching full local storage, have them manually delete instead of auto delete
      // sessionstorage over local storage, make save button that just transfers from session to local
      // autosave one in localstorage called local-autosaved that continuously updates on the most recent change
      console.log('updating-local-storage', sessionId)
      if (sessionId?.startsWith('local-'))
        localStorage.setItem(sessionId, JSON.stringify(snapshot))
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

  if (error) {
    throw new Error(error)
  }

  return <App session={rootModel.session} />
})

export default props => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <JBrowse {...props} />
    </ThemeProvider>
  )
}
