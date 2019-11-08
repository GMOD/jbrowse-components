import '@gmod/jbrowse-core/fonts/material-icons.css'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { onSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import 'typeface-roboto'
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

  const { session, jbrowse } = root
  if (firstLoad && session) setFirstLoad(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        const configSnapshot = await ipcRenderer.invoke('loadConfig')
        const r = rootModel.create({ jbrowse: configSnapshot })

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
    if (session) {
      disposer = onSnapshot(session, async snapshot => {
        const sources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 500, height: 500 },
        })
        const jbWindow = sources.find(source => source.name === 'JBrowse')
        const screenshot = jbWindow.thumbnail.toDataURL()
        ipcRenderer.send('saveSession', snapshot, screenshot)
      })
    }

    return disposer
  }, [session, jbrowse])

  useEffect(() => {
    let disposer = () => {}
    if (jbrowse) {
      disposer = onSnapshot(jbrowse, snapshot => {
        ipcRenderer.send('saveConfig', snapshot)
      })
    }

    return disposer
  }, [jbrowse])

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
