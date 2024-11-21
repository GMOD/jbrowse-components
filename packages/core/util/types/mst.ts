import { types } from 'mobx-state-tree'
import { nanoid } from '../nanoid'

export const ElementId = types.optional(types.identifier, () => nanoid())

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
  locationType: types.literal('LocalPathLocation'),
  localPath: types.string,
})

// like how blobId is used to get a blob map
export const BlobLocation = types.model('BlobLocation', {
  locationType: types.literal('BlobLocation'),
  name: types.string,
  blobId: types.string,
})

export const UriLocationRaw = types.model('UriLocation', {
  locationType: types.literal('UriLocation'),
  uri: types.string,
  baseUri: types.maybe(types.string),

  internetAccountId: types.maybe(types.string),

  // auths information (such as tokens) needed for using this resource.
  // if provided, these must be completely sufficient for using it
  internetAccountPreAuthorization: types.maybe(
    types.model('InternetAccountPreAuthorization', {
      internetAccountType: types.string,
      authInfo: types.frozen(),
    }),
  ),
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
