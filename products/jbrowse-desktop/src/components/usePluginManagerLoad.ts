import { useEffect } from 'react'

import { destroyPluginManager } from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

// Builds a plugin manager from whatever the Loader's query string asked for — a
// local config/session path (?config=) or a JBrowse Web link the main process
// forwarded (?specLink=) — and cancels a stale result if `source` changes while a
// previous load is still in flight, destroying the abandoned PluginManager so its
// RPC workers don't leak.
//
// `load` and onLoad/onError must be stable (a module-level function, or
// useEventCallback) so the effect re-runs only when `source` changes: a re-render
// mid-load must not start a second load.
export function usePluginManagerLoad(
  source: string | undefined,
  load: (source: string) => Promise<PluginManager>,
  onLoad: (pm: PluginManager) => void,
  onError: (e: unknown) => void,
) {
  useEffect(() => {
    let cancelled = false
    if (source) {
      void (async () => {
        try {
          const pm = await load(source)
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
  }, [source, load, onLoad, onError])
}
