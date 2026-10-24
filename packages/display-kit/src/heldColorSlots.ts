import { heldSlotsOf } from '@jbrowse/core/util/categoricalField'
import { isSessionModel } from '@jbrowse/core/util/types'
import { findParent, getRoot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

/**
 * The slots a categorical color deals its values into (ADR-205), kept by the
 * session and shared by every track coloring by the same field, domain and
 * range, so a gene symbol paints one color down every panel and a color
 * edit deals afresh. A deal with `reserved` colors keeps slots of its own,
 * since a value another track dealt first could hold a reserved color.
 * Undefined under any other scale.
 */
export function heldColorSlots(
  node: object,
  encoding: ColorEncoding | undefined,
  reserved: readonly string[] = [],
): HeldSlots | undefined {
  if (typeof encoding !== 'object' || encoding.scale !== 'ordinal') {
    return undefined
  }
  const owner =
    isStateTreeNode(node) && !isSessionModel(node)
      ? (findParent(node, isSessionModel) ?? getRoot<object>(node))
      : node
  const { field, domain = [], range = [] } = encoding
  return heldSlotsOf(
    owner,
    JSON.stringify(
      reserved.length > 0
        ? [field, domain, range, reserved]
        : [field, domain, range],
    ),
  )
}
