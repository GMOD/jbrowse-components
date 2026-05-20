import { useCallback, useEffect, useState } from 'react'

import { setGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'
import { ErrorMessage, createJBrowseTheme } from '@jbrowse/core/ui'
import { localStorageGetItem } from '@jbrowse/core/util'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowse from './JBrowse.tsx'
import { useQueryParam } from '../useQueryParam.ts'
import StartScreen from './StartScreen/StartScreen.tsx'
import { loadPluginManager } from './StartScreen/util.tsx'

import type { DesktopRootModel } from '../rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

setGpuOverride(new URLSearchParams(window.location.search).get('renderer'))

// Loads a plugin manager from a URL-provided config path. Cancels stale results
// if config changes while a previous load is still in flight.
function useConfigLoad(
  config: string | undefined,
  onLoad: (pm: PluginManager) => void,
  onError: (e: unknown) => void,
) {
  useEffect(() => {
    let cancelled = false
    if (config) {
      void (async () => {
        try {
          const pm = await loadPluginManager(config)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            onLoad(pm)
          }
        } catch (e) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            console.error(e)
            onError(e)
          }
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [config, onLoad, onError])
}

const Loader = observer(function Loader() {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config, setConfig] = useQueryParam('config')
  const [error, setError] = useState<unknown>()

  const handleSetPluginManager = useCallback(
    (pm: PluginManager) => {
      ;(pm.rootModel as DesktopRootModel | undefined)?.setOpenNewSessionCallback(
        async (path: string) => {
          handleSetPluginManager(await loadPluginManager(path))
        },
      )

      setPluginManager(pm)
      setError(undefined)
      setConfig('')
    },
    [setConfig],
  )

  useConfigLoad(config, handleSetPluginManager, setError)

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

export default Loader
