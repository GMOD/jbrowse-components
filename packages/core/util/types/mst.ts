/* eslint-disable @typescript-eslint/no-explicit-any */
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

export const UriLocationRaw = types.model('UriLocation', {
  uri: types.string, // TODO: refine
  baseUri: types.maybe(types.string),
})

export const UriLocation = types.snapshotProcessor(UriLocationRaw, {
  postProcessor: snap => {
    // this has to be type `any` otherwise get error
    // Exported variable 'libs' has or is using name '$nonEmptyObject' from external module "/home/cdiesh/src/jbrowse-components/node_modules/mobx-state-tree/dist/types/complex-types/model" but cannot be named.
    const { baseUri, ...rest } = snap as any
    if (!baseUri) {
      return rest
    }

    return snap
  },
})

export const FileLocation = types.union(LocalPathLocation, UriLocation)
