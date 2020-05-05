import '@gmod/jbrowse-core/fonts/material-icons.css'
import { App, theme } from '@gmod/jbrowse-core/ui'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React from 'react'

const JBrowse = observer(({ pluginManager }) => {
  const { rootModel } = pluginManager
  return <App session={rootModel.session} />
})

export default props => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <JBrowse {...props} />
    </ThemeProvider>
  )
}
