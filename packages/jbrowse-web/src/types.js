import shortid from 'shortid'

import { types } from 'mobx-state-tree'

export const IdType = types.optional(types.identifier, shortid.generate)

export const Region = types.model('Region', {
  assembly: types.string,
  ref: types.string,
  start: types.integer,
  end: types.integer,
})
