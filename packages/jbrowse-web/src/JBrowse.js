import { readConfObject } from '@gmod/jbrowse-core/configuration'
import '@gmod/jbrowse-core/fonts/material-icons.css'
import { toUrlSafeB64, fromUrlSafeB64 } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { getSnapshot, onSnapshot } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import 'typeface-roboto'
import rootModel from './rootModel'
import App from './ui/App'
import Theme from './ui/theme'

export default observer(({ config }) => {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [root, setRoot] = useState({})

  useEffect(() => {
    async function loadConfig() {
      try {
        let configSnapshot = config
        if (config.uri || config.localPath) {
          const configText = await openLocation(config).readFile('utf8')
          configSnapshot = JSON.parse(configText)
        }
        const r = rootModel.create({ jbrowse: configSnapshot })
        const params = new URL(document.location).searchParams
        const session = params.get('session')
        if (session)
          try {
            r.setSession(JSON.parse(fromUrlSafeB64(session)))
          } catch (error) {
            console.error('could not load session from URL', error)
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
  }, [config])

  useEffect(() => {
    let disposer = () => {}
    if (root.session)
      disposer = onSnapshot(root.session, snapshot => {
        root.jbrowse.updateSavedSession(snapshot)
      })

    return disposer
  }, [root.jbrowse, root.session])

  useEffect(() => {
    let localStorageIntervalId
    if (status === 'loaded')
      localStorageIntervalId = setInterval(() => {
        localStorage.setItem(
          'jbrowse-web-data',
          JSON.stringify(getSnapshot(root.session)),
        )
      }, 3000)

    return () => {
      clearInterval(localStorageIntervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const { session, jbrowse } = root
  const { configuration } = jbrowse || {}
  useEffect(() => {
    let urlIntervalId
    if (session) {
      const updateUrl = readConfObject(configuration, 'updateUrl')
      if (updateUrl)
        urlIntervalId = setInterval(() => {
          const l = document.location
          const updatedUrl = `${l.origin}${l.pathname}?session=${toUrlSafeB64(
            JSON.stringify(getSnapshot(session)),
          )}`
          window.history.replaceState({}, '', updatedUrl)
        }, 3000)
    }

    return () => {
      clearInterval(urlIntervalId)
    }
  }, [configuration, session])

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
