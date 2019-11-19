import '@gmod/jbrowse-core/fonts/material-icons.css'
import { useDebounce } from '@gmod/jbrowse-core/util'
import {
  App,
  FatalErrorDialog,
  FactoryResetDialog,
  StartScreen,
  theme,
} from '@gmod/jbrowse-core/ui'

import Button from '@material-ui/core/CircularProgress'
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
const JBrowse = observer(() => {
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
        const config = await ipcRenderer.invoke('loadConfig')
        Object.assign(config, {
          configuration: {
            rpc: {
              defaultDriver: 'ElectronRpcDriver',
            },
          },
        })

        setRoot(rootModel.create({ jbrowse: config }))
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
    let disposer = () => {}
    if (jbrowse) {
      disposer = onSnapshot(jbrowse, snap => {
        setConfigSnapshot(snap)
      })
    }

    return disposer
  }, [jbrowse])
  useEffect(() => {
    let disposer = () => {}
    if (session) {
      disposer = onSnapshot(session, snap => {
        setSessionSnapshot(snap)
      })
    }

    return disposer
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

  useEffect(() => {
    if (root) {
      window.MODEL = root.session
      window.ROOTMODEL = root
    }
  }, [root, root.session])

  if (loaded) {
    return session ? (
      <App session={session} />
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
const ResetComponent = props => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        color="primary"
        variant="contained"
        onClick={() => setDialogOpen(true)}
      >
        Factory reset
      </Button>
      <FactoryResetDialog
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
      />
    </>
  )
}
export default props => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary
        FallbackComponent={<FatalErrorDialog ResetComponent={ResetComponent} />}
      >
        <JBrowse {...props} />
      </ErrorBoundary>
    </ThemeProvider>
  )
}
