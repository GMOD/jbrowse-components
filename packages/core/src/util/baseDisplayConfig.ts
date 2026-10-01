import { hasParent } from '@jbrowse/mobx-state-tree'

import { getConf } from '../configuration/getConf.ts'
import { getContainingTrack, getSession } from './mstUtils.ts'
import { isSessionWithBaseTrackConfig } from './types/index.ts'

/**
 * #api core/util
 * The base's entry for this display, hydrated, which a reset returns to and
 * "is this the reader's" compares against: the config.json's, or the one a
 * track the session owns was added with; empty in a session that keeps no
 * base.
 */
export function baseDisplayConfig(self: object): Record<string, unknown> {
  if (!hasParent(self)) {
    return {}
  }
  const session = getSession(self)
  if (!isSessionWithBaseTrackConfig(session)) {
    return {}
  }
  const base = session.baseTrackConfig(
    getConf(getContainingTrack(self), 'trackId'),
  )
  const { displayId } = (self as { configuration: { displayId: string } })
    .configuration
  const displays = base?.displays
  return (
    (Array.isArray(displays)
      ? (displays as Record<string, unknown>[]).find(
          d => d.displayId === displayId,
        )
      : undefined) ?? {}
  )
}
