import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { reloadSessionLoader } from '../createSessionLoader.ts'
import { disposeLoader } from './disposeLoader.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'

// Activates the loader (which runs its own ready-watching autorun) and
// disposes on unmount or loader swap. Plugin reloads come back through
// `setLoader`, which swaps in a fresh loader constructed from the previous
// one + new config/session snapshots.
export function useLoaderLifecycle(
  loader: SessionLoaderModel,
  setLoader: Dispatch<SetStateAction<SessionLoaderModel>>,
) {
  useEffect(() => {
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
