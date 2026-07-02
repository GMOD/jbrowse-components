import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyModelType, SnapshotIn } from '@jbrowse/mobx-state-tree'

/**
 * Apply the `Core-extendSession` extension point and drop the legacy
 * object-shaped `connectionInstances` from incoming snapshots (the schema
 * changed from an object to an array, so old snapshots must be filtered out,
 * xref https://github.com/GMOD/jbrowse-components/issues/1903).
 *
 * Shared by the web session (`finalizeWebSession`) and the desktop session
 * factory so the extension point + migration live in one place.
 */
export function finalizeSession<T extends IAnyModelType>(
  pluginManager: PluginManager,
  sessionModel: T,
) {
  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-extendSession | sync | Extend the session model with extra state or actions */
    'Core-extendSession',
    sessionModel,
  ) as T

  return types.snapshotProcessor(extendedSessionModel, {
    preProcessor(
      snapshot: SnapshotIn<T> & {
        connectionInstances?: unknown
      },
    ) {
      const { connectionInstances, ...rest } = snapshot
      return !Array.isArray(connectionInstances) ? rest : snapshot
    },
  })
}
