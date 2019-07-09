import '@gmod/jbrowse-core/fonts/material-icons.css'
import CircularProgress from '@material-ui/core/CircularProgress'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/styles'
import { observer } from 'mobx-react'
import React from 'react'
import 'typeface-roboto'
import App from './ui/App'
import Theme from './ui/theme'

export default observer(({ state }) => {
  let DisplayComponent = (
    <CircularProgress
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        marginTop: -250,
        marginLeft: -250,
      }}
      size={500}
    />
  )
  if (state.errorMessage) DisplayComponent = <div>{state.errorMessage}</div>
  if (state.activeSession)
    DisplayComponent = (
      <App
        session={state.activeSession}
        sessionNames={state.sessionNames}
        setActiveSession={state.activateSession}
        addSession={state.addSession}
      />
    )

  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      {DisplayComponent}
    </ThemeProvider>
  )
})
