import '@gmod/jbrowse-core/fonts/material-icons.css'
import { useDebounce } from '@gmod/jbrowse-core/util'
import {
  App,
  FatalErrorDialog,
  StartScreen,
  useTheme,
} from '@gmod/jbrowse-core/ui'

import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'

import { ThemeProvider } from '@material-ui/styles'

import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import ErrorBoundary from 'react-error-boundary'
import React, { useEffect, useState } from 'react'
import rootModel from './rootModel'
import 'typeface-roboto'

const { electron = {} } = window
const { desktopCapturer, ipcRenderer } = electron

const debounceMs = 1000

function useJBrowseDesktop() {
  const [loaded, setLoaded] = useState(false)
  const [root, setRoot] = useState({})
  const [firstLoad, setFirstLoad] = useState(true)
  const [sessionSnapshot, setSessionSnapshot] = useState()
  const [configSnapshot, setConfigSnapshot] = useState()
  const debouncedSessionSnapshot = useDebounce(sessionSnapshot, debounceMs)
  const debouncedConfigSnapshot = useDebounce(configSnapshot, debounceMs)

  const { session, jbrowse } = root
  if (firstLoad && session) setFirstLoad(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        setRoot(
          rootModel.create({
            jbrowse: Object.assign(await ipcRenderer.invoke('loadConfig'), {
              configuration: {
                rpc: {
                  defaultDriver: 'ElectronRpcDriver',
                },
              },
            }),
          }),
        )
        setLoaded(true)
      } catch (e) {
        setLoaded(() => {
          // throw to error boundary
          throw e
        })
      }
    }

    loadConfig()
  }, [])

  useEffect(() => {
    return jbrowse
      ? onSnapshot(jbrowse, snap => {
          setConfigSnapshot(snap)
        })
      : () => {}
  }, [jbrowse])
  useEffect(() => {
    return session
      ? onSnapshot(session, snap => {
          setSessionSnapshot(snap)
        })
      : () => {}
  }, [session])

  useEffect(() => {
    ;(async () => {
      if (debouncedSessionSnapshot) {
        const sources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 500, height: 500 },
        })
        const jbWindow = sources.find(source => source.name === 'JBrowse')
        const screenshot = jbWindow.thumbnail.toDataURL()
        ipcRenderer.send('saveSession', debouncedSessionSnapshot, screenshot)
      }
    })()
  }, [debouncedSessionSnapshot])

  useEffect(() => {
    if (debouncedConfigSnapshot) {
      ipcRenderer.send('saveConfig', debouncedConfigSnapshot)
    }
  }, [debouncedConfigSnapshot])
  return [root, loaded, firstLoad]
}

const JBrowse = observer(() => {
  const [root, loaded, firstLoad] = useJBrowseDesktop()
  useEffect(() => {
    if (root) {
      window.MODEL = root.session
      window.ROOTMODEL = root
    }
  }, [root, root.session])

  if (loaded) {
    return root.session ? (
      <App session={root.session} />
    ) : (
      <StartScreen root={root} bypass={firstLoad} />
    )
  }
  return (
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
})

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
