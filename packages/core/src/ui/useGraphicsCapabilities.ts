import { useEffect, useState } from 'react'

import { getGraphicsCapabilities } from './getGraphicsCapabilities.ts'

import type { GraphicsCapabilities } from './getGraphicsCapabilities.ts'

export function useGraphicsCapabilities() {
  const [graphicsCapabilities, setGraphicsCapabilities] =
    useState<GraphicsCapabilities | null>(null)

  useEffect(() => {
    getGraphicsCapabilities()
      .then(setGraphicsCapabilities)
      .catch(() => {
        // Silent fail
      })
  }, [])

  return graphicsCapabilities
}
