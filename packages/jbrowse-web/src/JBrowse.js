import { readConfObject } from '@gmod/jbrowse-core/configuration'
import '@gmod/jbrowse-core/fonts/material-icons.css'
import { App, useTheme, FatalErrorDialog } from '@gmod/jbrowse-core/ui'
import {
  toUrlSafeB64,
  fromUrlSafeB64,
  useDebounce,
  inDevelopment,
  mergeConfigs,
} from '@gmod/jbrowse-core/util'
import ErrorBoundary from 'react-error-boundary'

import { openLocation } from '@gmod/jbrowse-core/util/io'

// material-ui
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'

import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import 'typeface-roboto'

import rootModel from './rootModel'

async function parseConfig(configLoc) {
  const config = JSON.parse(await openLocation(configLoc).readFile('utf8'))
  if (inDevelopment) {
    config.datasets = mergeConfigs(
      config,
      JSON.parse(
        await openLocation({ uri: 'test_data/config_in_dev.json' }).readFile(
          'utf8',
        ),
      ),
    )
  }
  return config
}

function useJBrowseWeb(config, initialState) {
  const [loaded, setLoaded] = useState(false)
  const [root, setRoot] = useState(initialState || {})
  const [urlSnapshot, setUrlSnapshot] = useState()
  const debouncedUrlSnapshot = useDebounce(urlSnapshot, 400)
  const debouncedLoaded = useDebounce(loaded, 400)

  // This serializes the session to URL
  useEffect(() => {
    if (debouncedUrlSnapshot) {
      const { origin, pathname } = document.location
      window.history.replaceState(
        {},
        '',
        `${origin}${pathname}?session=${toUrlSafeB64(
          JSON.stringify(debouncedUrlSnapshot),
        )}`,
      )
    }
  }, [debouncedUrlSnapshot])

  // This updates savedSession list on the rootModel
  useEffect(() => {
    if (root && root.session && debouncedUrlSnapshot) {
      root.jbrowse.updateSavedSession(debouncedUrlSnapshot)
    }
  }, [debouncedUrlSnapshot, root])

  const { session, jbrowse } = root || {}

  const useLocalStorage = jbrowse
    ? readConfObject(jbrowse.configuration, 'useLocalStorage')
    : false

  // This loads a config from localStorage or a configSnapshot or a config.json file
  useEffect(() => {
    async function loadConfig() {
      try {
        let r
        if (initialState) {
          r = initialState
        } else {
          let configSnapshot = config || {}
          const localStorageConfig =
            useLocalStorage && localStorage.getItem('jbrowse-web-data')
          if (localStorageConfig) {
            configSnapshot = JSON.parse(localStorageConfig)
          }
          if (configSnapshot.uri || configSnapshot.localPath) {
            configSnapshot = await parseConfig(config)
          }
          try {
            r = rootModel.create({ jbrowse: configSnapshot })
          } catch (error) {
            // if it failed to load, it's probably a problem with the saved sessions,
            // so just delete them and try again
            configSnapshot.savedSessions = []
            r = rootModel.create({ jbrowse: configSnapshot })
          }
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
          const parsedSession = JSON.parse(localStorageSession)
          if (parsedSession) r.setSession(parsedSession)
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
        setRoot(r)
        setLoaded(true)
      } catch (e) {
        setLoaded(() => {
          // throw to error boundary
          throw e
        })
      }
    }

    loadConfig()
  }, [config, initialState, useLocalStorage])

  // make some things available globally for testing
  // e.g. window.MODEL.views[0] in devtools
  useEffect(() => {
    if (root) {
      window.MODEL = root.session
      window.ROOTMODEL = root
    }
  }, [root, root.session])

  // set session in localstorage
  useEffect(
    () =>
      useLocalStorage && loaded
        ? onSnapshot(root.session, snapshot => {
            localStorage.setItem(
              'jbrowse-web-session',
              JSON.stringify(snapshot),
            )
          })
        : () => {},
    [loaded, root.session, useLocalStorage],
  )

  // set jbrowse-web data in localstorage
  useEffect(
    () =>
      useLocalStorage && loaded
        ? onSnapshot(root.jbrowse, snapshot => {
            localStorage.setItem('jbrowse-web-data', JSON.stringify(snapshot))
          })
        : () => {},
    [loaded, root.jbrowse, useLocalStorage],
  )

  const updateUrl = jbrowse
    ? readConfObject(jbrowse.configuration, 'updateUrl')
    : false
  useEffect(
    () =>
      session && updateUrl
        ? onSnapshot(session, snapshot => {
            setUrlSnapshot(snapshot)
          })
        : () => {},
    [updateUrl, session],
  )

  // debouncedLoaded for making the loading spinner a little longer
  // on the screen (just for looks)
  return [debouncedLoaded, root]
}

const JBrowse = observer(({ config, initialState }) => {
  const [loaded, root] = useJBrowseWeb(config, initialState)
  return !loaded ? (
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
  ) : (
    <App session={root.session} />
  )
})

export { JBrowse }

export default props => {
  return (
    <ThemeProvider theme={useTheme()}>
      <CssBaseline />
      <ErrorBoundary FallbackComponent={FatalErrorDialog}>
        <JBrowse {...props} />
      </ErrorBoundary>
    </ThemeProvider>
  )
}
