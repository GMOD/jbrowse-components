import { useEffect, useMemo, useState } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { localStorageGetItem } from '@jbrowse/core/util'
import { setGpuOverride } from '@jbrowse/render-core/gpuDevice'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowse from './JBrowse.tsx'
import { NotificationProvider } from './Notifications.tsx'
import { useNotifyError } from './NotifyContext.ts'
import { useQueryParam } from '../useQueryParam.ts'
import StartScreen from './StartScreen/StartScreen.tsx'
import { destroyPluginManager, loadPluginManager } from './StartScreen/util.tsx'

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

const LoaderContents = observer(function LoaderContents() {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config, setConfig] = useQueryParam('config')
  const notifyError = useNotifyError()

  const handleSetPluginManager = (pm: PluginManager) => {
    ;(pm.rootModel as DesktopRootModel | undefined)?.setOpenNewSessionCallback(
      async (path: string) => {
        handleSetPluginManager(await loadPluginManager(path))
      },
    )

    setPluginManager(prev => {
      // a new session/plugin-reload replaces the manager: tear down the old
      // one so its RPC workers + autosave loop don't leak. destroy is
      // idempotent (guarded by isAlive) so this stays safe under re-renders.
      if (prev && prev !== pm) {
        destroyPluginManager(prev)
      }
      return pm
    })
    setConfig('')
  }

  const handleConfigError = (e: unknown) => {
    notifyError(e)
    // fall back to the start screen so the user can pick another config
    setConfig('')
  }

  useConfigLoad(config, handleSetPluginManager, handleConfigError)

  return pluginManager?.rootModel?.session ? (
    <JBrowse pluginManager={pluginManager} />
  ) : !config ? (
    <StartScreen setPluginManager={handleSetPluginManager} />
  ) : null
})

export default function Loader() {
  const theme = useMemo(
    () =>
      createJBrowseTheme(
        undefined,
        undefined,
        localStorageGetItem('themeName') || 'default',
      ),
    [],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <LoaderContents />
      </NotificationProvider>
    </ThemeProvider>
  )
}
