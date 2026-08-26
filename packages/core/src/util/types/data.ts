import type {
  BlobLocation as MUBlobLocation,
  FileHandleLocation as MUFileHandleLocation,
  Region as MUIRegion,
  LocalPathLocation as MULocalPathLocation,
  NoAssemblyRegion as MUNoAssemblyRegion,
  UriLocation as MUUriLocation,
} from './mst.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Plain data: a genomic interval, the four file locations, and the plugin store
// entries. Nothing here knows what a session, a view or a track is, which is the
// point — `./index.ts` next door carries the application's session family, and a
// coordinate utility importing `Region` from there pulls PluginManager and every
// widget into its type graph. See
// `agent-docs/ideas/barrels-block-extraction.md`, and
// `scripts/moduleClosure.ts` for the number.
//
// The only dependency is `./mst.ts`, whose own graph is itself and nanoid: these
// stay `SnapshotIn` of the MST models rather than hand-written shapes so the two
// spellings cannot drift, and because `UriLocation`'s preauthorization payload
// is `types.frozen()` and its readers index into it.

// Empty interfaces required by @jbrowse/mobx-state-tree
// See https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
export interface NoAssemblyRegion extends SnapshotIn<
  typeof MUNoAssemblyRegion
> {}

/**
 * a description of a specific genomic region. assemblyName, refName, start,
 * end, and reversed
 */
export interface Region extends SnapshotIn<typeof MUIRegion> {}

export interface AugmentedRegion extends Region {
  originalRefName?: string
}

export interface LocalPathLocation extends SnapshotIn<
  typeof MULocalPathLocation
> {}

export interface UriLocation extends SnapshotIn<typeof MUUriLocation> {}

export interface BlobLocation extends SnapshotIn<typeof MUBlobLocation> {}

export interface FileHandleLocation extends SnapshotIn<
  typeof MUFileHandleLocation
> {}

export type FileLocation =
  | LocalPathLocation
  | UriLocation
  | BlobLocation
  | FileHandleLocation

export function isUriLocation(location: unknown): location is UriLocation {
  return (
    typeof location === 'object' &&
    location !== null &&
    'uri' in location &&
    !!location.uri
  )
}

export function isLocalPathLocation(
  location: unknown,
): location is LocalPathLocation {
  return (
    typeof location === 'object' &&
    location !== null &&
    'localPath' in location &&
    !!location.localPath
  )
}

export function isBlobLocation(location: unknown): location is BlobLocation {
  return (
    typeof location === 'object' &&
    location !== null &&
    'blobId' in location &&
    !!location.blobId
  )
}

export function isFileHandleLocation(
  location: unknown,
): location is FileHandleLocation {
  return (
    typeof location === 'object' &&
    location !== null &&
    'handleId' in location &&
    !!location.handleId
  )
}

// These types are slightly different than the MST models representing a
// location because a blob cannot be stored in a MST, so this is the
// pre-processed file location
export interface PreUriLocation {
  uri: string
}
export interface PreLocalPathLocation {
  localPath: string
}
export interface PreBlobLocation {
  blob: File
}
export interface PreFileHandleLocation {
  handle: FileSystemFileHandle
}
export type PreFileLocation =
  | PreUriLocation
  | PreLocalPathLocation
  | PreBlobLocation
  | PreFileHandleLocation

export class AuthNeededError extends Error {
  url: string

  constructor(message: string, url: string) {
    super(message)
    this.url = url
    this.name = 'AuthNeededError'

    Object.setPrototypeOf(this, AuthNeededError.prototype)
  }
}

// The name alone, deliberately: this also has to recognize an AuthNeededError
// that crossed the worker boundary, and serializeError/deserializeError carry
// `name` through, so the cross-realm case needs no structural fallback. It used
// to also accept any error carrying a `url` property, which routed ordinary
// fetch failures into RpcManager's auth-retry path and prompted for a login.
export function isAuthNeededException(
  exception: unknown,
): exception is AuthNeededError {
  return exception instanceof Error && exception.name === 'AuthNeededError'
}

export interface BasePlugin {
  version?: string
  name: string
  url?: string
}

// A single published plugin version and the semver range of JBrowse versions it
// supports. The url fields mirror the top-level JBrowsePlugin url fields.
export interface JBrowsePluginVersion {
  pluginVersion: string
  jbrowseRange: string
  url?: string
  umdUrl?: string
  esmUrl?: string
  cjsUrl?: string
  integrity?: string
}

export interface JBrowsePlugin {
  name: string
  packageName?: string
  authors: string[]
  description: string
  location: string
  url?: string
  umdUrl?: string
  esmUrl?: string
  cjsUrl?: string
  integrity?: string
  // v2 plugin store entries list per-version urls + JBrowse compatibility ranges.
  // When absent, the top-level url applies to all JBrowse versions.
  versions?: JBrowsePluginVersion[]
  // The store's version-agnostic `latest/` path, published for config
  // generators. Deliberately not among the urls `publishedBuilds` /
  // `resolvePlugin` consider: it is mutable and carries no integrity hash, so
  // installing from it would break the hash on the next publish — the whole
  // reason an install pins a version.
  latestUrl?: string
  license: string
  image?: string
  // Free-form labels from the store manifest, used to filter the store list.
  // Deliberately `string[]` and not a union: the vocabulary lives in
  // jbrowse-plugin-list's plugins.json, so the store discovers whatever tags are
  // actually published rather than needing a release here to learn a new one.
  tags?: string[]
}
