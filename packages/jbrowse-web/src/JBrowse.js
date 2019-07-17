import '@gmod/jbrowse-core/fonts/material-icons.css'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import 'typeface-roboto'
import jbrowseModel from './jbrowseModel'
import App from './ui/App'
import Theme from './ui/theme'

export default observer(({ config }) => {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [jbrowseState, setJBrowseState] = useState()

  useEffect(() => {
    let intervalId
    async function loadConfig() {
      try {
        let configSnapshot = config
        if (config.uri || config.localPath) {
          const configText = await openLocation(config).readFile('utf8')
          configSnapshot = JSON.parse(configText)
        }
        const params = new URL(document.location).searchParams
        const session = params.get('session')
        if (session)
          try {
            configSnapshot.session = JSON.parse(atob(session))
          } catch (error) {
            console.error('could not load session from URL', error)
          }
        const state = jbrowseModel.create(configSnapshot)
        if (!state.session) state.setEmptySession()
        intervalId = setInterval(() => {
          const l = document.location
          const updatedUrl = `${l.origin}${l.pathname}?session=${btoa(
            JSON.stringify(getSnapshot(state.session)),
          )}`
          window.history.replaceState({}, '', updatedUrl)
        }, 3000)
        // poke some things for testing (this stuff will eventually be removed)
        window.ROOTMODEL = state
        window.MODEL = state.session
        setJBrowseState(state)
        setStatus('loaded')
      } catch (error) {
        setStatus('error')
        setMessage(String(error))
        console.error(error)
      }
    }

    loadConfig()

    return () => {
      clearInterval(intervalId)
    }
  }, [config])

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
  if (status === 'loaded' && jbrowseState.session)
    DisplayComponent = (
      <App
        session={jbrowseState.session}
        sessionNames={jbrowseState.sessionNames}
        addSessionSnapshot={jbrowseState.addSessionSnapshot}
        activateSession={jbrowseState.activateSession}
      />
    )

  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      {DisplayComponent}
    </ThemeProvider>
  )
})
