import { types } from '@jbrowse/mobx-state-tree'
import { nanoid } from '../nanoid.ts'

export const ElementId = types.optional(types.identifier, () => nanoid(10))
