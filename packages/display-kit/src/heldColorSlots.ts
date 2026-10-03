import { heldSlotsOf } from '@jbrowse/core/util/categoricalField'
import { isSessionModel, isTrackModel } from '@jbrowse/core/util/types'
import { getParent, hasParent, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

/**
 * The slots a categorical colour on `node`'s track deals its values into
 * (ADR-205), kept by the session, so hiding and showing the track or opening a
 * second view of it keeps every colour. One set per field, domain and range: a
 * colour object changing any of them deals afresh. Undefined under any other
 * scale.
 */
export function heldColorSlots(
  node: object,
  encoding: ColorEncoding | undefined,
): HeldSlots | undefined {
  if (typeof encoding !== 'object' || encoding.scale !== 'categorical') {
    return undefined
  }
  let owner: object = node
  let trackId = ''
  while (isStateTreeNode(owner) && !isSessionModel(owner) && hasParent(owner)) {
    owner = getParent<object>(owner)
    if (trackId === '' && isTrackModel(owner)) {
      trackId = owner.configuration.trackId
    }
  }
  const { field, domain = [], range = [] } = encoding
  return heldSlotsOf(owner, JSON.stringify([trackId, field, domain, range]))
}
