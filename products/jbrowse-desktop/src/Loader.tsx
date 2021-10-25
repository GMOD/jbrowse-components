import React, { useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react'
import PluginManager from '@jbrowse/core/PluginManager'
import { CssBaseline, ThemeProvider } from '@material-ui/core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { StringParam, useQueryParam } from 'use-query-params'

// locals
import { loadPluginManager } from './StartScreen/util'
import JBrowse from './JBrowse'
import StartScreen from './StartScreen'

const Loader = observer(() => {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config, setConfig] = useQueryParam('config', StringParam)
  const [error, setError] = useState<unknown>()

  const handleSetPluginManager = useCallback(
    (pm: PluginManager) => {
      // @ts-ignore
      pm.rootModel?.setOpenNewSessionCallback(async (path: string) => {
        handleSetPluginManager(await loadPluginManager(path))
      })

      // @ts-ignore
      setPluginManager(pm)
      setError(undefined)
      setConfig('')
    },
    [setConfig],
  )

  useEffect(() => {
    ;(async () => {
      if (config) {
        try {
          handleSetPluginManager(await loadPluginManager(config))
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }
    })()
  }, [config, handleSetPluginManager])

  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <CssBaseline />

      {error ? <ErrorMessage error={error} /> : null}
      {pluginManager?.rootModel?.session ? (
        <JBrowse pluginManager={pluginManager} />
      ) : !config || error ? (
        <StartScreen
          setError={setError}
          setPluginManager={handleSetPluginManager}
        />
      ) : null}
    </ThemeProvider>
  )
})

export default Loader
