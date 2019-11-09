import '@gmod/jbrowse-core/fonts/material-icons.css'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import 'typeface-roboto'
import { useDebounce } from '@gmod/jbrowse-core/util'
import rootModel from './rootModel'
import App from './ui/App'
import StartScreen from './ui/StartScreen'
import Theme from './ui/theme'

const { electron = {} } = window
const { desktopCapturer, ipcRenderer } = electron

export default observer(() => {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [root, setRoot] = useState({})
  const [firstLoad, setFirstLoad] = useState(true)
  const [sessionSnapshot, setSessionSnapshot] = useState()
  const [configSnapshot, setConfigSnapshot] = useState()
  const debouncedSessionSnapshot = useDebounce(sessionSnapshot, 5000)
  const debouncedConfigSnapshot = useDebounce(configSnapshot, 5000)

  const { session, jbrowse } = root
  if (firstLoad && session) setFirstLoad(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await ipcRenderer.invoke('loadConfig')
        const r = rootModel.create({ jbrowse: config })

        // poke some things for testing (this stuff will eventually be removed)
        window.ROOTMODEL = r
        window.MODEL = r.session
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
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      {DisplayComponent}
    </ThemeProvider>
  )
})
