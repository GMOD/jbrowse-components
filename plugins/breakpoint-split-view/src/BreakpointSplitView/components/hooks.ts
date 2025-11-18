import { useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { getSnapshot } from 'mobx-state-tree'

import { useNextFrame } from '../util'

import type { BreakpointViewModel } from '../model'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export function useOverlaySetup(model: BreakpointViewModel) {
  const snap = getSnapshot(model)
  useNextFrame(snap)
  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session
  const assembly = assemblyManager.get(model.views[0]?.assemblyNames[0] ?? '')

  return { session, assembly }
}

export function useMouseoverTracking<T = string>() {
  const [mouseoverElt, setMouseoverElt] = useState<T>()

  return {
    mouseoverElt,
    handlers: {
      onMouseOver: (id: T) => () => {
        setMouseoverElt(id)
      },
      onMouseOut: () => () => {
        setMouseoverElt(undefined)
      },
    },
  }
}
