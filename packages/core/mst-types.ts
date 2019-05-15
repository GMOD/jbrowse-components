import shortid from 'shortid'
import { types, SnapshotOut } from 'mobx-state-tree'
import propTypes from 'prop-types'
import { PropTypes as MxPropTypes } from 'mobx-react'

import { assembleLocString } from './util'

export const ElementId = types.optional(types.identifier, shortid.generate)

// PropTypes that are useful when working with instances of these in react components
export const PropTypes = {
  Region: propTypes.shape({
    refName: propTypes.string.isRequired,
    start: propTypes.number.isRequired,
    end: propTypes.number.isRequired,
  }),
  ConfigSchema: MxPropTypes.objectOrObservableObject,
  Feature: propTypes.shape({
    get: propTypes.func.isRequired,
    id: propTypes.func.isRequired,
  }),
}

export const NoAssemblyRegion = types
  .model('Region', {
    refName: types.string,
    start: types.number,
    end: types.number,
  })
  .views(self => ({
    get locString() {
      return assembleLocString(self)
    },
  }))

export type INoAssemblyRegion = SnapshotOut<typeof NoAssemblyRegion>

export const Region = types.compose(
  NoAssemblyRegion,
  types.model({
    assemblyName: types.string,
  }),
)

export type IRegion = SnapshotOut<typeof Region>

export const FileLocalPath = types.model('FileLocalPath', {
  localPath: types.string, // TODO: refine
})

export const Uri = types.model('Uri', {
  uri: types.string, // TODO: refine
})

export const FileLocation = types.union(FileLocalPath, Uri)
