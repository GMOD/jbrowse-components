import { useEffect } from 'react'

import { destroyPluginManager, openSpecLink } from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

// Loads a session from a JBrowse Web link the main process forwarded as
// ?specLink= (a jbrowse:// link the OS handed us). Mirrors useConfigLoad: stale
// results are cancelled and their PluginManager destroyed, so a link arriving
// mid-load can't leak the abandoned manager's RPC workers. onLoad/onError must
// be stable (e.g. useEventCallback).
export function useSpecLinkLoad(
  specLink: string | undefined,
  onLoad: (pm: PluginManager) => void,
  onError: (e: unknown) => void,
) {
  useEffect(() => {
    let cancelled = false
    if (specLink) {
      void (async () => {
        try {
          const pm = await openSpecLink(specLink)
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
  }, [specLink, onLoad, onError])
}
