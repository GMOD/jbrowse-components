import { types } from '@jbrowse/mobx-state-tree'

import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

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

// FileHandleLocation stores a reference to a FileSystemFileHandle via IndexedDB
// The handleId is used to retrieve the handle from IndexedDB storage
export const FileHandleLocation = types.model('FileHandleLocation', {
  locationType: types.literal('FileHandleLocation'),
  name: types.string,
  handleId: types.string,
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
    // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
    const { baseUri, ...rest } = snap
    if (!baseUri) {
      return rest
    }
    return snap
  },
})

const FileLocationUnion = types.union(
  LocalPathLocation,
  UriLocation,
  BlobLocation,
  FileHandleLocation,
)

// pre-locationType legacy snapshots stored only the discriminating field (uri,
// localPath, blob, handleId) with no locationType tag
interface LegacyFileLocation {
  locationType?: undefined
  uri?: string
  localPath?: string
  blob?: string
  handleId?: string
}

export const FileLocation = types.snapshotProcessor<
  typeof FileLocationUnion,
  SnapshotIn<typeof FileLocationUnion> | LegacyFileLocation
>(FileLocationUnion, {
  // legacy untagged snapshots are loosely shaped (e.g. a bare `uri` with no
  // blobId/name for the blob case), so the inferred result can't statically
  // satisfy the strict union; MST re-validates it against the union at runtime
  // @ts-expect-error
  preProcessor(snap) {
    if (snap.locationType) {
      return snap
    } else {
      const { uri, localPath, blob } = snap
      const inferredLocationType =
        uri !== undefined
          ? 'UriLocation'
          : localPath !== undefined
            ? 'LocalPathLocation'
            : blob !== undefined
              ? 'BlobLocation'
              : 'FileHandleLocation'
      return { ...snap, locationType: inferredLocationType }
    }
  },
})

export { ElementId, createElementId } from './ElementId.ts'
