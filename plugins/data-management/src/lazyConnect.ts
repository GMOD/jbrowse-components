import { isAlive } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/** the subset of a connection model that a `doConnect` implementation needs */
export interface ConnectionDoConnectArg {
  configuration: AnyConfigurationModel
  addTrackConfs: (arg: Record<string, unknown>[]) => void
  // true when re-establishing on session load; suppress first-connect side
  // effects (view launch, success snackbar)
  silent?: boolean
}

/**
 * Lazily load a connection's `doConnect` implementation and run it, guarding
 * against the node being destroyed during the dynamic import (e.g. a React
 * StrictMode double-mount disposes the first rootModel). `doConnect` walks up
 * to the session, which requires a live node.
 */
export async function lazyConnect<
  T extends ConnectionDoConnectArg & IAnyStateTreeNode,
>(
  self: T,
  loadDoConnect: () => Promise<{
    doConnect: (self: ConnectionDoConnectArg) => unknown
  }>,
) {
  const { doConnect } = await loadDoConnect()
  if (isAlive(self)) {
    await doConnect(self)
  }
}
