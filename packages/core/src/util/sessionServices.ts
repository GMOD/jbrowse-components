import { cachedParent, findParentThatIs } from './parentWalk.ts'
import { isSessionServices } from './types/services.ts'

import type {
  DialogHost,
  NotificationSink,
  PaletteHost,
  RpcHost,
  SessionServices,
} from './types/services.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// `getSession(self).notify(...)` and `getNotificationSink(self).notify(...)`
// find the same object; the difference is what the calling module then has in
// its type graph, which is the whole session interface in the first case and
// four function signatures in the second. The return annotations are therefore
// deliberate rather than inferred — widening one back to `SessionServices`
// would undo the point of the accessor.

const sessionServicesCache = new WeakMap<IAnyStateTreeNode, SessionServices>()

/**
 * #api core/util
 * The services a session offers that cost nothing application-shaped to name.
 * Prefer one of the narrower accessors below, which say which of them the
 * calling module actually uses.
 */
export function getSessionServices(node: IAnyStateTreeNode): SessionServices {
  return cachedParent(
    sessionServicesCache,
    node,
    () => findParentThatIs(node, isSessionServices),
    'no session model found!',
  )
}

/**
 * #api core/util
 * The host's RPC entry point, for a module that issues RPCs and nothing else.
 */
export function getRpcHost(node: IAnyStateTreeNode): RpcHost {
  return getSessionServices(node)
}

/**
 * #api core/util
 * Where a display puts a message it cannot draw itself.
 */
export function getNotificationSink(node: IAnyStateTreeNode): NotificationSink {
  return getSessionServices(node)
}

/**
 * #api core/util
 * Where a display puts a dialog it cannot mount itself.
 */
export function getDialogHost(node: IAnyStateTreeNode): DialogHost {
  return getSessionServices(node)
}

/**
 * #api core/util
 * The colors to draw with, and the args that rebuild them in a worker.
 */
export function getPaletteHost(node: IAnyStateTreeNode): PaletteHost {
  return getSessionServices(node)
}
