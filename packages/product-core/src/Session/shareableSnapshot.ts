import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * The session snapshot to hand to anyone else: a share link, an exported
 * `session.json`. The one place an outgoing snapshot is taken, so anything the
 * live session resolves against state that stays behind has a place to go.
 */
export function getShareableSessionSnapshot(session: AbstractSessionModel) {
  return structuredClone(getSnapshot(session)) as Record<string, unknown>
}
