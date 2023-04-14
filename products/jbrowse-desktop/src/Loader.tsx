import React, { useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react'
import { CssBaseline, ThemeProvider } from '@mui/material'

// jbrowse
import PluginManager from '@jbrowse/core/PluginManager'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { localStorageGetItem } from '@jbrowse/core/util'
import { StringParam, useQueryParam } from 'use-query-params'

// locals
import { loadPluginManager } from './StartScreen/util'
import JBrowse from './JBrowse'
import StartScreen from './StartScreen'

export default observer(() => {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config, setConfig] = useQueryParam('config', StringParam)
  const [error, setError] = useState<unknown>()

  const handleSetPluginManager = useCallback(
    (pm: PluginManager) => {
      // @ts-expect-error
      pm.rootModel?.setOpenNewSessionCallback(async (path: string) => {
        handleSetPluginManager(await loadPluginManager(path))
      })

      setPluginManager(pm)
      setError(undefined)
      setConfig('')
    },
    [setConfig],
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    <ThemeProvider
      theme={createJBrowseTheme(
        undefined,
        undefined,
        localStorageGetItem('themeName') || 'default',
      )}
    >
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
