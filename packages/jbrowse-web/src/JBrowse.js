import '@gmod/jbrowse-core/fonts/material-icons.css'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import 'typeface-roboto'
import jbrowseModel from './jbrowseModel'
import App from './ui/App'
import Theme from './ui/theme'

export default observer(({ config, initialState }) => {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [jbrowseState, setJBrowseState] = useState(initialState)

  useEffect(() => {
    async function loadConfig() {
      try {
        let configSnapshot = config
        if (config && (config.uri || config.localPath)) {
          const configText = await openLocation(config).readFile('utf8')
          configSnapshot = JSON.parse(configText)
        }
        let state
        if (jbrowseState) {
          state = jbrowseState
        } else {
          state = jbrowseModel.create(configSnapshot)
          setJBrowseState(state)
        }
        if (!state.session) state.setEmptySession()
        // poke some things for testing (this stuff will eventually be removed)
        window.ROOTMODEL = state
        window.MODEL = state.session
        setStatus('loaded')
      } catch (error) {
        setStatus('error')
        setMessage(String(error))
        console.error(error)
      }
    }

    loadConfig()
  }, [config, jbrowseState])

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
