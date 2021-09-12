import React, { useState } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { CssBaseline, ThemeProvider } from '@material-ui/core'
import { observer } from 'mobx-react'
import JBrowse from './JBrowse'
import StartScreen from './StartScreen'
import { createJBrowseTheme } from '@jbrowse/core/ui'

function Loader() {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <CssBaseline />
      {pluginManager?.rootModel?.session ? (
        <JBrowse pluginManager={pluginManager} />
      ) : (
        <StartScreen setPluginManager={setPluginManager} />
      )}
    </ThemeProvider>
  )
}

export default observer(Loader)
