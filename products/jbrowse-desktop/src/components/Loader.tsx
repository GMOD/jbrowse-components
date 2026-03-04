import { useCallback, useEffect, useState } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { localStorageGetItem } from '@jbrowse/core/util'
import { Alert, CssBaseline, Snackbar, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowse from './JBrowse.tsx'
import { useQueryParam } from '../useQueryParam.ts'
import StartScreen from './StartScreen/StartScreen.tsx'
import {
  createStartScreenPluginManager,
  loadPluginManager,
} from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

const Loader = observer(function Loader() {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [startScreenPluginManager, setStartScreenPluginManager] =
    useState<PluginManager>()
  const [globalPluginError, setGlobalPluginError] = useState<string>()
  const [config, setConfig] = useQueryParam('config')
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
    createStartScreenPluginManager()
      .then(pm => {
        setStartScreenPluginManager(pm)
      })
      .catch(e => {
        console.error('Failed to create start screen plugin manager', e)
        setGlobalPluginError(`Global plugins failed to load: ${e}`)
      })
  }, [])

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
          startScreenPluginManager={startScreenPluginManager}
        />
      ) : null}
      <Snackbar
        open={!!globalPluginError}
        autoHideDuration={10_000}
        onClose={() => setGlobalPluginError(undefined)}
      >
        <Alert
          severity="error"
          onClose={() => setGlobalPluginError(undefined)}
        >
          {globalPluginError}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  )
})

export default Loader
