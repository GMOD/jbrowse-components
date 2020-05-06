import { readConfObject } from '@gmod/jbrowse-core/configuration'
import '@gmod/jbrowse-core/fonts/material-icons.css'
import { App, theme } from '@gmod/jbrowse-core/ui'
import { toUrlSafeB64, useDebounce } from '@gmod/jbrowse-core/util'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { getSnapshot, onSnapshot } from 'mobx-state-tree'
import queryString from 'query-string'
import React, { useEffect, useState } from 'react'

const MAX_SESSION_SIZE_IN_URL = 100000

const JBrowse = observer(({ pluginManager }) => {
  const [urlSnapshot, setUrlSnapshot] = useState()
  const debouncedUrlSnapshot = useDebounce(urlSnapshot, 400)

  const { rootModel } = pluginManager
  const { session, jbrowse, error } = rootModel || {}
  const useLocalStorage = jbrowse
    ? readConfObject(jbrowse.configuration, 'useLocalStorage')
    : false

  const useUpdateUrl = jbrowse
    ? readConfObject(jbrowse.configuration, 'updateUrl')
    : false

  // This serializes the session to URL
  useEffect(() => {
    if (debouncedUrlSnapshot) {
      const parsed = queryString.parse(document.location.search)
      const urlSplit = window.location.href.split('?')
      const json = JSON.stringify(debouncedUrlSnapshot)
      if (json.length < MAX_SESSION_SIZE_IN_URL) {
        parsed.session = toUrlSafeB64(json)
      } else {
        parsed.session = undefined
      }
      window.history.replaceState(
        {},
        '',
        `${urlSplit[0]}?${queryString.stringify(parsed)}`,
      )
    }
  }, [debouncedUrlSnapshot])

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
    setUrlSnapshot(getSnapshot(session))
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
