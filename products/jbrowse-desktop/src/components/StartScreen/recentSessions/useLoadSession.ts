import { useState } from 'react'

import { loadPluginManager } from '../util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export function useLoadSession({
  setPluginManager,
  setError,
}: {
  setPluginManager: (pm: PluginManager) => void
  setError: (e: unknown) => void
}) {
  const [loading, setLoading] = useState(false)

  const launch = async (path: string) => {
    setLoading(true)
    try {
      setPluginManager(await loadPluginManager(path))
    } catch (e) {
      console.error(e)
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  return { launch, loading }
}
