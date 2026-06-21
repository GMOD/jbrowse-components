import { useEffect } from 'react'

import { destroyPluginManager, loadPluginManager } from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

// Loads a plugin manager from a URL-provided config path. Cancels stale results
// if config changes while a previous load is still in flight. onLoad/onError
// must be stable (e.g. useEventCallback) so the effect re-runs only when
// `config` changes — a re-render mid-load must not start a second load, which
// would leak the abandoned PluginManager's RPC workers.
export function useConfigLoad(
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
          if (cancelled) {
            destroyPluginManager(pm)
          } else {
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
