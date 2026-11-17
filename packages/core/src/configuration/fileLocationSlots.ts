import { getMembers } from '@jbrowse/mobx-state-tree'

import { isConfigurationModel } from './schemaTypes.ts'
import {
  getSlotDefinition,
  isConfigurationSlot,
  makeSlotFacade,
} from './slotFacade.ts'

import type { SlotFacade } from './slotFacade.ts'
import type { AnyConfigurationModel } from './types.ts'

/**
 * The file location slots of a config and of each sub-schema under it (a
 * BAM's `bamLocation` and its `index`'s `location`), each as the facade the
 * settings form edits it through, labelled by its path ("index location").
 * A location held inside a frozen slot, such as a wrapped adapter's, is not
 * a slot and is not listed.
 */
export function fileLocationSlots(
  node: AnyConfigurationModel,
  path: string[] = [],
): { label: string; slot: SlotFacade }[] {
  return Object.keys(getMembers(node).properties).flatMap(name => {
    const member: unknown = node[name]
    return isConfigurationModel(member)
      ? fileLocationSlots(member, [...path, name])
      : isConfigurationSlot(node, name) &&
          (getSlotDefinition(node, name).type === 'fileLocation' ||
            getSlotDefinition(node, name).type === 'maybeFileLocation')
        ? [
            {
              label: [...path, name].join(' '),
              slot: makeSlotFacade(node, name),
            },
          ]
        : []
  })
}
