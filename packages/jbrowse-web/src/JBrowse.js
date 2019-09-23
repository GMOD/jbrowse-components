import { readConfObject } from '@gmod/jbrowse-core/configuration'
import '@gmod/jbrowse-core/fonts/material-icons.css'
import {
  toUrlSafeB64,
  fromUrlSafeB64,
  useDebounce,
} from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import 'typeface-roboto'
import rootModel from './rootModel'
import App from './ui/App'
import Theme from './ui/theme'

export default observer(({ config, initialState }) => {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [root, setRoot] = useState(initialState || {})
  const [urlSnapshot, setUrlSnapshot] = useState()
  const debouncedUrlSnapshot = useDebounce(urlSnapshot, 400)

  useEffect(() => {
    if (debouncedUrlSnapshot) {
      const l = document.location
      const updatedUrl = `${l.origin}${l.pathname}?session=${toUrlSafeB64(
        JSON.stringify(debouncedUrlSnapshot),
      )}`
      window.history.replaceState({}, '', updatedUrl)
    }
  }, [debouncedUrlSnapshot])

  useEffect(() => {
    async function loadConfig() {
      try {
        let r
        if (initialState) r = initialState
        else {
          let configSnapshot = config || {}
          const localStorageConfig = localStorage.getItem('jbrowse-web-data')
          if (localStorageConfig)
            configSnapshot = JSON.parse(localStorageConfig)
          if (configSnapshot.uri || configSnapshot.localPath) {
            const configText = await openLocation(config).readFile('utf8')
            configSnapshot = JSON.parse(configText)
          }
          r = rootModel.create({ jbrowse: configSnapshot })
        }
        const params = new URL(document.location).searchParams
        const urlSession = params.get('session')
        if (urlSession) {
          try {
            const savedSessionIndex = r.jbrowse.savedSessionNames.indexOf(
              urlSession,
            )
            if (savedSessionIndex !== -1) {
              r.setSession(r.jbrowse.savedSessions[savedSessionIndex])
            } else {
              r.setSession(JSON.parse(fromUrlSafeB64(urlSession)))
            }
          } catch (error) {
            console.error('could not load session from URL', error)
          }
        } else {
          const localStorageSession = localStorage.getItem(
            'jbrowse-web-session',
          )
          try {
            const parsedSession = JSON.parse(localStorageSession)
            if (parsedSession) r.setSession(parsedSession)
          } catch (error) {
            console.error('could not load session from local storage', error)
          }
        }
        if (!r.session) {
          if (r.jbrowse.savedSessions.length) {
            const { name } = r.jbrowse.savedSessions[0]
            r.activateSession(name)
          } else {
            r.setDefaultSession()
          }
        }

        r.setHistory(UndoManager.create({}, { targetStore: r.session }))
        // poke some things for testing (this stuff will eventually be removed)
        setRoot(r)
        setStatus('loaded')
      } catch (error) {
        setStatus('error')
        setMessage(String(error))
        console.error(error)
      }
    }

    loadConfig()
  }, [config, initialState])

  useEffect(() => {
    if (root) {
      window.MODEL = root.session
      window.ROOTMODEL = root
    }
  }, [root, root.session])

  useEffect(() => {
    let disposer = () => {}
    if (root && root.session)
      disposer = onSnapshot(root.session, snapshot => {
        root.jbrowse.updateSavedSession(snapshot)
      })

    return disposer
  }, [root])

  const { session, jbrowse } = root || {}
  const useLocalStorage = jbrowse
    ? readConfObject(jbrowse.configuration, 'useLocalStorage')
    : false
  useEffect(() => {
    let localStorageSessionDisposer = () => {}
    let localStorageDataDisposer = () => {}
    if (useLocalStorage && status === 'loaded') {
      localStorageSessionDisposer = onSnapshot(root.session, snapshot => {
        localStorage.setItem('jbrowse-web-session', JSON.stringify(snapshot))
      })
      localStorageDataDisposer = onSnapshot(root.jbrowse, snapshot => {
        localStorage.setItem('jbrowse-web-data', JSON.stringify(snapshot))
      })
    }

    return () => {
      localStorageSessionDisposer()
      localStorageDataDisposer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root && root.session && root.session.name, status, useLocalStorage])

  const updateUrl = jbrowse
    ? readConfObject(jbrowse.configuration, 'updateUrl')
    : false
  useEffect(() => {
    let urlDisposer = () => {}
    if (session) {
      if (updateUrl)
        urlDisposer = onSnapshot(session, snapshot => {
          setUrlSnapshot(snapshot)
        })
    }

    return urlDisposer
  }, [updateUrl, session])

  let DisplayComponent = (
    <CircularProgress
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        marginTop: -25,
        marginLeft: -25,
      }}
      size={50}
    />
  )
  if (status === 'error') DisplayComponent = <div>{message}</div>
  if (status === 'loaded' && root.session)
    DisplayComponent = <App session={root.session} />

  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      {DisplayComponent}
    </ThemeProvider>
  )
})
