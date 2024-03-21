import { types } from 'mobx-state-tree'
import propTypes from 'prop-types'
import { PropTypes as MxPropTypes } from 'mobx-react'

import { nanoid } from '../nanoid'

export const ElementId = types.optional(types.identifier, () => nanoid())

// PropTypes that are useful when working with instances of these in react components
export const PropTypes = {
  ConfigSchema: MxPropTypes.objectOrObservableObject,
  Feature: propTypes.shape({
    get: propTypes.func.isRequired,
    id: propTypes.func.isRequired,
  }),
  Region: propTypes.shape({
    end: propTypes.number.isRequired,
    refName: propTypes.string.isRequired,
    start: propTypes.number.isRequired,
  }),
}

export const NoAssemblyRegion = types
  .model('NoAssemblyRegion', {
    end: types.number,
    refName: types.string,
    reversed: types.optional(types.boolean, false),
    start: types.number,
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
  localPath: types.string,
  locationType: types.literal('LocalPathLocation'),
})

// like how blobId is used to get a blob map
export const BlobLocation = types.model('BlobLocation', {
  blobId: types.string,
  locationType: types.literal('BlobLocation'),
  name: types.string,
})

export const UriLocationRaw = types.model('UriLocation', {
  baseUri: types.maybe(types.string),
  internetAccountId: types.maybe(types.string),
  // auths information (such as tokens) needed for using this resource.
  // if provided, these must be completely sufficient for using it
  internetAccountPreAuthorization: types.maybe(
    types.model('InternetAccountPreAuthorization', {
      authInfo: types.frozen(),
      internetAccountType: types.string,
    }),
  ),

  locationType: types.literal('UriLocation'),

  uri: types.string,
})

export const UriLocation = types.snapshotProcessor(UriLocationRaw, {
  postProcessor: snap => {
    // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
    const { baseUri, ...rest } = snap as Omit<typeof snap, symbol>
    if (!baseUri) {
      return rest
    }
    return snap
  },
})

export const FileLocation = types.snapshotProcessor(
  types.union(LocalPathLocation, UriLocation, BlobLocation),
  {
    // @ts-expect-error
    preProcessor(snap) {
      if (!snap) {
        return undefined
      }

      // @ts-expect-error
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      const { locationType, ...rest } = snap as Omit<typeof snap, symbol>
      if (!locationType) {
        // @ts-expect-error
        const { uri, localPath, blob } = rest
        let locationType = ''
        if (uri !== undefined) {
          locationType = 'UriLocation'
        } else if (localPath !== undefined) {
          locationType = 'LocalPathLocation'
        } else if (blob !== undefined) {
          locationType = 'BlobLocation'
        }

        return { ...rest, locationType }
      }
      return snap
    },
  },
)
