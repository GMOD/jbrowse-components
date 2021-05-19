import shortid from 'shortid'
import { types } from 'mobx-state-tree'
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
  .model('NoAssemblyRegion', {
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

export const Region = types.compose(
  'Region',
  NoAssemblyRegion,
  types.model({
    assemblyName: types.string,
  }),
)

export const LocalPathLocation = types.model('LocalPathLocation', {
  localPath: types.string, // TODO: refine
})

export const BlobLocation = types.model('BlobLocation', {
  name: types.string, // TODO: refine
  blobId: types.string,
})

export const UriLocationRaw = types.model('UriLocation', {
  uri: types.string, // TODO: refine
  baseUri: types.maybe(types.string),
})

export const UriLocation = types.snapshotProcessor(UriLocationRaw, {
  postProcessor: snap => {
    const { baseUri, ...rest } = snap
    if (!baseUri) {
      return rest
    }
    return snap
  },
})

export const FileLocation = types.union(
  LocalPathLocation,
  UriLocation,
  BlobLocation,
)
