import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { App, theme } from '@gmod/jbrowse-core/ui'
import { toUrlSafeB64 } from '@gmod/jbrowse-core/util'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { getSnapshot, onSnapshot } from 'mobx-state-tree'
import { StringParam, useQueryParam } from 'use-query-params'
import React, { useEffect, useRef } from 'react'

const MAX_SESSION_SIZE_IN_URL = 100000

const JBrowse = observer(({ pluginManager }) => {
  const urlLastUpdated = useRef(Date.now())
  const [, setSession] = useQueryParam('session', StringParam)

  const { rootModel } = pluginManager
  const { session, jbrowse, error } = rootModel || {}
  const useLocalStorage = jbrowse
    ? readConfObject(jbrowse.configuration, 'useLocalStorage')
    : false

  const useUpdateUrl = jbrowse
    ? readConfObject(jbrowse.configuration, 'useUrlSession')
    : false

  // Set session URL on first render only, before `onSnapshot` has fired
  useEffect(() => {
    if (useUpdateUrl) {
      const json = JSON.stringify(getSnapshot(session))
      const sess =
        json.length < MAX_SESSION_SIZE_IN_URL ? toUrlSafeB64(json) : undefined
      setSession(sess)
    }
  }, [session, setSession, useUpdateUrl])

  useEffect(() => {
    if (session && useUpdateUrl) {
      return onSnapshot(session, snapshot => {
        if (Date.now() - urlLastUpdated.current > 1000) {
          const json = JSON.stringify(snapshot)
          const sess =
            json.length < MAX_SESSION_SIZE_IN_URL
              ? toUrlSafeB64(json)
              : undefined

          if (useUpdateUrl) {
            setSession(sess)
          }
          if (rootModel && rootModel.session) {
            rootModel.jbrowse.updateSavedSession(snapshot)
          }
          if (useLocalStorage) {
            localStorage.setItem(
              'jbrowse-web-session',
              JSON.stringify(snapshot),
            )
          }
          urlLastUpdated.current = Date.now()
        }
      })
    }
    return () => {}
  }, [rootModel, setSession, useLocalStorage, useUpdateUrl, session])

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
