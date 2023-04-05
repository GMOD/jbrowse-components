import React, { useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react'
import PluginManager from '@jbrowse/core/PluginManager'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { StringParam, useQueryParam } from 'use-query-params'

// locals
import { loadPluginManager } from './StartScreen/util'
import JBrowse from './JBrowse'
import StartScreen from './StartScreen'
import { localStorageGetItem } from '@jbrowse/core/util'

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
    <>
      <CssBaseline />
      {error ? <ErrorMessage error={error} /> : null}
      {pluginManager?.rootModel?.session ? (
        <JBrowse pluginManager={pluginManager} />
      ) : !config || error ? (
        <ThemeProvider
          theme={createJBrowseTheme(
            undefined,
            undefined,
            localStorageGetItem('themeName') || 'default',
          )}
        >
          <StartScreen
            setError={setError}
            setPluginManager={handleSetPluginManager}
          />
        </ThemeProvider>
      ) : null}
    </>
  )
})
