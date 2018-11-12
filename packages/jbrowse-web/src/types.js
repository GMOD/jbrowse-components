import shortid from 'shortid'
import { types, PropTypes } from 'mobx-state-tree'
import { assembleLocString } from './util'

export const IdType = types.optional(types.identifier, shortid.generate)

export const Region = types
  .model('Region', {
    assembly: types.string,
    refName: types.string,
    start: types.integer,
    end: types.integer,
  })
  .views(self => ({
    get locString() {
      return assembleLocString(self)
    },
  }))

export const BlockState = types.model('BlockState', {
  region: Region,
  content: types.optional(types.string, ''),
})
