import { useEffect } from 'react'

import {
  reloadSessionLoader,
  stripConsumedSessionParams,
} from '../createSessionLoader.ts'
import { disposeLoader } from './disposeLoader.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'

// Activates the loader (which runs its own ready-watching autorun) and
// disposes on unmount or loader swap. Plugin reloads come back through
// `setLoader`, which swaps in a fresh loader constructed from the previous
// one + new config/session snapshots.
//
// Stripping the consumed URL params happens here (not in the loader's
// useState initializer) so it runs only for the committed loader instance —
// StrictMode's double-invoked initializer must stay a pure URL read, otherwise
// the second read sees the stripped URL and e.g. loses the share `password`.
//
// The reload callback derives the replacement from `loader` rather than from a
// `setLoader(prev => ...)` updater: this callback is only ever reachable
// through the rootModel this very loader built, so `prev` is always `loader`,
// and React updaters must be pure — building an MST node inside one creates a
// throwaway tree on StrictMode's double invoke (and on any concurrent rebase).
// setLoader is typed to take a bare value, not a SetStateAction, so that stays
// true by construction.
export function useLoaderLifecycle(
  loader: SessionLoaderModel,
  setLoader: (loader: SessionLoaderModel) => void,
) {
  useEffect(() => {
    stripConsumedSessionParams()
    loader.activate((configSnapshot, sessionSnapshot) => {
      const next = reloadSessionLoader(loader, configSnapshot, sessionSnapshot)
      loader.setSuperseded()
      setLoader(next)
    })
    return () => {
      disposeLoader(loader)
    }
  }, [loader, setLoader])
}
