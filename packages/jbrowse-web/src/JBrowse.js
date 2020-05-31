import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { App, theme } from '@gmod/jbrowse-core/ui'
import { toUrlSafeB64, useDebounce } from '@gmod/jbrowse-core/util'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { getSnapshot, onSnapshot } from 'mobx-state-tree'
import { StringParam, useQueryParam } from 'use-query-params'
import React, { useEffect, useState } from 'react'

const MAX_SESSION_SIZE_IN_URL = 100000

const JBrowse = observer(({ pluginManager }) => {
  const [urlSnapshot, setUrlSnapshot] = useState()
  const debouncedUrlSnapshot = useDebounce(urlSnapshot, 400)
  const [, setSession] = useQueryParam('session', StringParam)

  const { rootModel } = pluginManager
  const { session, jbrowse, error } = rootModel || {}
  const useLocalStorage = jbrowse
    ? readConfObject(jbrowse.configuration, 'useLocalStorage')
    : false

  const useUpdateUrl = jbrowse
    ? readConfObject(jbrowse.configuration, 'useUrlSession')
    : false

  // This serializes the session to URL
  useEffect(() => {
    if (debouncedUrlSnapshot) {
      const json = JSON.stringify(debouncedUrlSnapshot)
      const sess =
        json.length < MAX_SESSION_SIZE_IN_URL ? toUrlSafeB64(json) : undefined

      setSession(sess)
    }
  }, [debouncedUrlSnapshot, setSession])

  // This updates savedSession list on the rootModel
  useEffect(() => {
    if (rootModel && rootModel.session && debouncedUrlSnapshot) {
      rootModel.jbrowse.updateSavedSession(debouncedUrlSnapshot)
    }
  }, [debouncedUrlSnapshot, rootModel])

  // set session in localstorage
  useEffect(
    () =>
      useLocalStorage
        ? onSnapshot(rootModel.session, snapshot => {
            localStorage.setItem(
              'jbrowse-web-session',
              JSON.stringify(snapshot),
            )
          })
        : () => {},
    [rootModel, useLocalStorage],
  )

  // Set session URL on first render only, before `onSnapshot` has fired
  useEffect(() => {
    if (useUpdateUrl) {
      setUrlSnapshot(getSnapshot(session))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () =>
      session && useUpdateUrl
        ? onSnapshot(session, snapshot => {
            setUrlSnapshot(snapshot)
          })
        : () => {},
    [useUpdateUrl, session],
  )

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
