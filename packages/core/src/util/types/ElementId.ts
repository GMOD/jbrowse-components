import { types } from '@jbrowse/mobx-state-tree'

import { nanoid } from '../nanoid.ts'

export function createElementId() {
  return nanoid(10)
}

export const ElementId = types.optional(types.identifier, createElementId)
