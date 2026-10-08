import { heldSlotsOf } from '@jbrowse/core/util/categoricalField'
import { isSessionModel } from '@jbrowse/core/util/types'
import { getParent, hasParent, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

/**
 * The slots a categorical color deals its values into (ADR-205), kept by the
 * session and shared by every track coloring by the same field, domain and
 * range, so a gene symbol paints one color down every panel and a color
 * edit deals afresh. Undefined under any other scale.
 */
export function heldColorSlots(
  node: object,
  encoding: ColorEncoding | undefined,
): HeldSlots | undefined {
  if (typeof encoding !== 'object' || encoding.scale !== 'categorical') {
    return undefined
  }
  let owner: object = node
  while (isStateTreeNode(owner) && !isSessionModel(owner) && hasParent(owner)) {
    owner = getParent<object>(owner)
  }
  const { field, domain = [], range = [] } = encoding
  return heldSlotsOf(owner, JSON.stringify([field, domain, range]))
}
