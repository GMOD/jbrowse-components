import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

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
export function useLoaderLifecycle(
  loader: SessionLoaderModel,
  setLoader: Dispatch<SetStateAction<SessionLoaderModel>>,
) {
  useEffect(() => {
    stripConsumedSessionParams()
    loader.activate((configSnapshot, sessionSnapshot) => {
      setLoader(prev =>
        reloadSessionLoader(prev, configSnapshot, sessionSnapshot),
      )
    })
    return () => {
      disposeLoader(loader)
    }
  }, [loader, setLoader])
}
