import shortid from 'shortid'
import { types } from 'mobx-state-tree'
import { assembleLocString } from './util'

export const ElementId = types.optional(types.identifier, shortid.generate)

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

export const FileLocalPath = types.model('FileLocalPath', {
  localPath: types.string, // TODO: refine
})

export const Uri = types.model('Uri', {
  uri: types.string, // TODO: refine
})

export const FileLocation = types.union(FileLocalPath, Uri)
