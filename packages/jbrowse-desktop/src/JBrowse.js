import '@gmod/jbrowse-core/fonts/material-icons.css'
import { useDebounce } from '@gmod/jbrowse-core/util'
import { App, StartScreen, theme } from '@gmod/jbrowse-core/ui'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import ErrorBoundary from 'react-error-boundary'
import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
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
          // throw to error component
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

const FatalError = ({ componentStack, error }) => (
  <div style={{ backgroundColor: '#b99' }}>
    <p>
      <strong>Fatal error</strong>
    </p>
    <p>
      <strong>Error:</strong> {error.toString()}
    </p>
    <strong>Stacktrace:</strong>
    <pre> {componentStack}</pre>
  </div>
)

FatalError.propTypes = {
  componentStack: PropTypes.string.isRequired,
  error: PropTypes.shape({}).isRequired,
}

export default () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary FallbackComponent={FatalError}>
        <JBrowse />
      </ErrorBoundary>
    </ThemeProvider>
  )
}
