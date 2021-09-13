import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import PluginManager from '@jbrowse/core/PluginManager'
import { CssBaseline, ThemeProvider, Typography } from '@material-ui/core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  StringParam,
  QueryParamProvider,
  useQueryParam,
} from 'use-query-params'
import { ipcRenderer } from 'electron'

import { createPluginManager } from './StartScreen/util'

import JBrowse from './JBrowse'
import StartScreen from './StartScreen'

const Loader = observer(() => {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config, setConfig] = useQueryParam('config', StringParam)
  const [error, setError] = useState<Error>()

  useEffect(() => {
    ;(async () => {
      if (config) {
        try {
          const data = await ipcRenderer.invoke('loadSession', config)
          const pm = await createPluginManager(JSON.parse(data))
          setPluginManager(pm)
          setConfig('')
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }
    })()
  }, [config, setConfig])

  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <CssBaseline />
      {error ? (
        <Typography variant="h6" color="error">{`${error}`}</Typography>
      ) : null}
      {pluginManager?.rootModel?.session ? (
        <JBrowse pluginManager={pluginManager} />
      ) : !config || error ? (
        <StartScreen setPluginManager={setPluginManager} />
      ) : null}
    </ThemeProvider>
  )
})

function Wrapper() {
  return (
    <QueryParamProvider>
      <Loader />
    </QueryParamProvider>
  )
}

export default Wrapper
