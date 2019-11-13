import '@gmod/jbrowse-core/fonts/material-icons.css'
import { useDebounce } from '@gmod/jbrowse-core/util'
import { App, StartScreen, theme } from '@gmod/jbrowse-core/ui'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import rootModel from './rootModel'
import App from './ui/App'
import StartScreen from './ui/StartScreen'
import 'typeface-roboto'

const { electron = {} } = window
const { desktopCapturer, ipcRenderer } = electron

const debounceMs = 1000
export default observer(() => {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
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
        const r = rootModel.create({ jbrowse: config })

        setRoot(r)
        setStatus('loaded')
      } catch (error) {
        setStatus('error')
        setMessage(String(error))
        console.error(error)
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
    return () => {}
  }, [debouncedSessionSnapshot])

  useEffect(() => {
    if (debouncedConfigSnapshot) {
      ipcRenderer.send('saveConfig', debouncedConfigSnapshot)
    }

    return () => {}
  }, [debouncedConfigSnapshot])

  useEffect(() => {
    if (root) {
      window.MODEL = root.session
      window.ROOTMODEL = root
    }
  }, [root, root.session])

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
  if (status === 'loaded') {
    if (session) DisplayComponent = <App session={session} />
    else DisplayComponent = <StartScreen root={root} bypass={firstLoad} />
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {DisplayComponent}
    </ThemeProvider>
  )
})
