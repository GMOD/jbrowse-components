import shortid from 'shortid'
import { types, SnapshotOut, SnapshotIn } from 'mobx-state-tree'
import propTypes from 'prop-types'
import { PropTypes as MxPropTypes } from 'mobx-react'

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
    reversed: types.optional(types.boolean, false),
  })
  .actions(self => ({
    setRefName(newRefName: string): void {
      self.refName = newRefName
    },
  }))

type TNoAssemblyRegion = SnapshotIn<typeof NoAssemblyRegion>
export type INoAssemblyRegion = TNoAssemblyRegion

export const Region = types.compose(
  NoAssemblyRegion,
  types.model({
    assemblyName: types.string,
  }),
)

export type IRegion = SnapshotIn<typeof Region>

export const LocalPathLocation = types.model('LocalPathLocation', {
  localPath: types.string, // TODO: refine
})
export type ILocalPathLocation = SnapshotOut<typeof LocalPathLocation>

export const UriLocation = types.model('UriLocation', {
  uri: types.string, // TODO: refine
})
export type IUriLocation = SnapshotOut<typeof UriLocation>

export type IBlobLocation = { blob: Blob }

export const FileLocation = types.union(LocalPathLocation, UriLocation)
export type IFileLocation = ILocalPathLocation | IUriLocation | IBlobLocation
