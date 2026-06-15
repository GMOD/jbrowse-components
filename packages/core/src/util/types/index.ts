import type React from 'react'

import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type {
  BlobLocation as MUBlobLocation,
  FileHandleLocation as MUFileHandleLocation,
  LocalPathLocation as MULocalPathLocation,
  NoAssemblyRegion as MUNoAssemblyRegion,
  Region as MUIRegion,
  UriLocation as MUUriLocation,
} from './mst.ts'
import type TextSearchManager from '../../TextSearch/TextSearchManager.ts'
import type assemblyManager from '../../assemblyManager/index.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { BaseInternetAccountModel } from '../../pluggableElementTypes/models/index.ts'
import type RpcManager from '../../rpc/RpcManager.ts'
import type { MenuItem, SerializableThemeArgs } from '../../ui/index.ts'
import type { Feature } from '../simpleFeature.ts'
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
  Instance,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

export type * from './util.ts'

/** abstract type for a model that contains multiple views */
export interface AbstractViewContainer extends IStateTreeNode {
  views: AbstractViewModel[]
  removeView(view: AbstractViewModel): void
  addView(
    typeName: string,
    initialState?: Record<string, unknown>,
  ): AbstractViewModel
}
export function isViewContainer(
  thing: unknown,
): thing is AbstractViewContainer {
  return (
    isStateTreeNode(thing) &&
    'removeView' in thing &&
    'addView' in thing &&
    'views' in thing
  )
}

export type NotificationLevel = 'error' | 'info' | 'warning' | 'success'
export interface SnackAction {
  name: React.ReactElement | string
  onClick: () => void
}

export type AssemblyManager = Instance<ReturnType<typeof assemblyManager>>

export interface BasePlugin {
  version?: string
  name: string
  url?: string
}

export interface JBrowsePlugin {
  name: string
  authors: string[]
  description: string
  location: string
  url?: string
  umdUrl?: string
  esmUrl?: string
  cjsUrl?: string
  license: string
  image?: string
}

export type DialogComponentType =
  | React.LazyExoticComponent<React.FC<any>>
  | React.FC<any>

/**
 * the slice of a view that track-action menu items need: opening a track, and
 * (for views that show tracks) reporting which display is active for a given
 * track so the config editor can expand it and collapse the rest
 */
export interface TrackActionView {
  showTrack: (id: string) => void
  getActiveDisplayId?: (trackId: string) => string | undefined
}

/** minimum interface that all session state models must implement */
export interface AbstractSessionModel extends AbstractViewContainer {
  tracksById: Record<string, AnyConfigurationModel>
  getTracksById: () => Record<string, AnyConfigurationModel>
  jbrowse: IAnyStateTreeNode
  drawerPosition?: string
  configuration: AnyConfigurationModel
  rpcManager: RpcManager
  assemblyNames: string[]
  assemblies: AnyConfigurationModel[]
  selection?: unknown
  focusedViewId?: string
  themeName?: string
  theme?: ThemeOptions
  themeOptions?: SerializableThemeArgs
  hovered: unknown
  setHovered: (arg: unknown) => void
  setFocusedViewId?: (id: string) => void
  allThemes?: () => Record<string, ThemeOptions & { name?: string }>
  setSelection: (feature: Feature) => void
  setSession?: (arg: { name: string; [key: string]: unknown }) => void
  clearSelection: () => void
  duplicateCurrentSession?: () => void
  notify: (
    message: string,
    level?: NotificationLevel,
    action?: SnackAction,
  ) => void
  notifyError: (
    message: string,
    error?: unknown,
    extra?: unknown,
    action?: SnackAction,
  ) => void
  assemblyManager: AssemblyManager
  version: string
  gitCommit?: string
  getTrackActionMenuItems?: (arg: {
    config: AnyConfigurationModel
    effectiveConfig: Record<string, unknown>
    extraTrackActions?: MenuItem[]
    view?: TrackActionView
  }) => MenuItem[]
  getTrackActions?: (
    arg: AnyConfigurationModel,
    view?: TrackActionView,
  ) => MenuItem[]
  getTrackListMenuItems?: (
    arg: AnyConfigurationModel,
    view?: TrackActionView,
  ) => MenuItem[]
  addAssembly?: (conf: Record<string, unknown>) => void
  addSessionAssembly?: (conf: Record<string, unknown>) => void
  sessionAssemblies?: AnyConfigurationModel[]
  removeAssembly?: (name: string) => void
  textSearchManager?: TextSearchManager
  connections: AnyConfigurationModel[]
  deleteConnection?: (arg: AnyConfigurationModel) => void
  temporaryAssemblies?: unknown[]
  addTemporaryAssembly?: (arg: Record<string, unknown>) => void
  removeTemporaryAssembly?: (arg: string) => void
  sessionConnections?: AnyConfigurationModel[]
  sessionTracks?: AnyConfigurationModel[]
  connectionInstances?: {
    name: string
    connectionId: string
    tracks: AnyConfigurationModel[]
    configuration: AnyConfigurationModel
  }[]
  makeConnection?: (arg: AnyConfigurationModel) => void
  breakConnection?: (arg: AnyConfigurationModel) => void

  prepareToBreakConnection?: (
    arg: AnyConfigurationModel,
  ) => [() => void, Record<string, number>] | undefined
  adminMode?: boolean
  showWidget?: (widget: unknown) => void
  addWidget?: (
    typeName: string,
    id: string,
    initialState?: Record<string, unknown>,
    configuration?: { type: string },
  ) => Widget

  DialogComponent?: DialogComponentType

  DialogProps: Record<string, unknown> | undefined
  queueDialog<T extends DialogComponentType>(
    callback: (doneCallback: () => void) => [T, React.ComponentProps<T>],
  ): void
  name: string
  id?: string
  tracks: AnyConfigurationModel[]
}
export function isSessionModel(thing: unknown): thing is AbstractSessionModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'rpcManager' in thing &&
    'configuration' in thing
  )
}

/** abstract interface for a session allows editing configurations */
export interface SessionWithConfigEditing extends AbstractSessionModel {
  editConfiguration(
    configuration: AnyConfigurationModel,
    opts?: { expandedDisplayId?: string },
  ): void
  // persist an edited track snapshot (admins → jbrowse config in place, others
  // → a shareable same-id session-track override)
  updateTrackConfiguration(trackConf: {
    trackId: string
    [key: string]: unknown
  }): void
}
export function isSessionModelWithConfigEditing(
  t: unknown,
): t is SessionWithConfigEditing {
  return isSessionModel(t) && 'editConfiguration' in t
}

/** abstract interface for a session allows adding tracks */
export interface SessionWithAddTracks extends AbstractSessionModel {
  // returns the added config, or undefined if it was invalid (surfaced as a
  // snackbar) — see SessionTracks.addTrackConf
  addTrackConf(
    configuration: AnyConfigurationModel | SnapshotIn<AnyConfigurationModel>,
  ): AnyConfigurationModel | undefined
}
export function isSessionWithAddTracks(t: unknown): t is SessionWithAddTracks {
  return (
    isSessionModel(t) &&
    'addTrackConf' in t &&
    !('disableAddTracks' in t && t.disableAddTracks)
  )
}

/** abstract interface for a session that allows deleting track configs */
export interface SessionWithDeleteTrackConf extends AbstractSessionModel {
  deleteTrackConf(configuration: AnyConfigurationModel): void
}
export function isSessionWithDeleteTrackConf(
  t: unknown,
): t is SessionWithDeleteTrackConf {
  return isSessionModel(t) && 'deleteTrackConf' in t
}

/** abstract interface for a session allows adding tracks */
export interface SessionWithShareURL extends AbstractSessionModel {
  shareURL: string
}
export function isSessionWithShareURL(
  thing: unknown,
): thing is SessionWithShareURL {
  return isSessionModel(thing) && 'shareURL' in thing && !!thing.shareURL
}

export interface Widget {
  type: string
  id: string
  view?: { id: string }
}

/** Minimal map interface compatible with both native Map and MST IMSTMap */
export interface WidgetMap<K, V> {
  size: number
  has(key: K): boolean
  get(key: K): V | undefined
  keys(): IterableIterator<K>
  values(): IterableIterator<V>
  entries(): IterableIterator<[K, V]>
  forEach(callbackfn: (value: V, key: K) => void): void
  [Symbol.iterator](): IterableIterator<[K, V]>
}

/** abstract interface for a session that manages widgets */
export interface SessionWithWidgets extends AbstractSessionModel {
  minimized: boolean
  visibleWidget?: Widget
  widgets: WidgetMap<string, Widget>
  activeWidgets: WidgetMap<string, Widget>
  hideAllWidgets: () => void
  addWidget(
    typeName: string,
    id: string,
    initialState?: Record<string, unknown>,
    configuration?: { type: string },
  ): Widget
  showWidget(widget: unknown): void
  hideWidget(widget: unknown): void
}

/* only some sessions with widgets use a drawer widget */
export interface SessionWithDrawerWidgets extends SessionWithWidgets {
  drawerWidth: number
  resizeDrawer(arg: number): number
  minimizeWidgetDrawer(): void
  showWidgetDrawer: () => void
  drawerPosition: string
  setDrawerPosition(arg: string): void
}

export function isSessionModelWithWidgets(
  thing: unknown,
): thing is SessionWithWidgets {
  return isSessionModel(thing) && 'widgets' in thing
}
export interface SessionWithConnections {
  makeConnection: (arg: AnyConfigurationModel) => void
}
export function isSessionModelWithConnections(
  thing: unknown,
): thing is SessionWithConnections {
  return isSessionModel(thing) && 'makeConnection' in thing
}

export interface SessionWithConnectionEditing {
  addConnectionConf: (arg: AnyConfigurationModel) => void
}

export function isSessionModelWithConnectionEditing(
  thing: unknown,
): thing is SessionWithConnectionEditing {
  return isSessionModel(thing) && 'addConnectionConf' in thing
}

export interface SessionWithSessionPlugins extends AbstractSessionModel {
  sessionPlugins: JBrowsePlugin[]
  addSessionPlugin: (plugin: BasePlugin) => void
  removeSessionPlugin: (plugin: Record<string, unknown> | undefined) => void
}
export function isSessionWithSessionPlugins(
  thing: unknown,
): thing is SessionWithSessionPlugins {
  return isSessionModel(thing) && 'sessionPlugins' in thing
}

/** abstract interface for a session that manages a global selection */
export interface SelectionContainer extends AbstractSessionModel {
  selection?: unknown
  setSelection(thing: unknown): void
}
export function isSelectionContainer(
  thing: unknown,
): thing is SelectionContainer {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'selection' in thing &&
    'setSelection' in thing
  )
}

/** abstract interface for a session allows applying focus to views and widgets */
export interface SessionWithFocusedViewAndDrawerWidgets extends SessionWithDrawerWidgets {
  focusedViewId: string | undefined
  setFocusedViewId(id: string): void
}

/** minimum interface that all view state models must implement */
export interface AbstractViewModel {
  id: string
  type: string
  width: number
  minimized: boolean
  setWidth(width: number): void
  setMinimized(flag: boolean): void
  displayName: string | undefined
  setDisplayName: (arg: string) => void
  menuItems: () => MenuItem[]
  assemblyNames?: string[]
}
export function isViewModel(thing: unknown): thing is AbstractViewModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'width' in thing &&
    'setWidth' in thing
  )
}

type Display = { displayId: string } & AnyConfigurationModel

export interface AbstractTrackModel {
  id: string
  displays: AbstractDisplayModel[]
  configuration: AnyConfigurationModel & { displays: Display[] }
  minimized: boolean
}

export function isTrackModel(thing: unknown): thing is AbstractTrackModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'configuration' in thing &&
    typeof thing.configuration === 'object' &&
    thing.configuration !== null &&
    'trackId' in thing.configuration &&
    !!thing.configuration.trackId
  )
}

export interface AbstractDisplayModel {
  id: string
  parentTrack: AbstractTrackModel
  renderDelay: number
  rendererType: any
  cannotBeRenderedReason?: string
}
export function isDisplayModel(thing: unknown): thing is AbstractDisplayModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'configuration' in thing &&
    typeof thing.configuration === 'object' &&
    thing.configuration !== null &&
    'displayId' in thing.configuration &&
    !!thing.configuration.displayId
  )
}

export interface TrackViewModel extends AbstractViewModel {
  showTrack(trackId: string): void
  hideTrack(trackId: string): void
}
export function isTrackViewModel(thing: unknown): thing is TrackViewModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'showTrack' in thing &&
    'hideTrack' in thing
  )
}

/** minimum interface for the root MST model of a JBrowse app */
export interface AbstractRootModel {
  jbrowse: IAnyStateTreeNode
  session?: AbstractSessionModel
  setSession?(arg: { name: string; [key: string]: unknown }): void
  setDefaultSession?(): void
  adminMode?: boolean
  error?: unknown
}

/** root model with more included for the heavier JBrowse web and desktop app */
export interface AppRootModel extends AbstractRootModel {
  internetAccounts: BaseInternetAccountModel[]
  findAppropriateInternetAccount(
    location: UriLocation,
  ): BaseInternetAccountModel | undefined
  createEphemeralInternetAccount(
    internetAccountId: string,
    initialSnapshot: Record<string, unknown>,
    url: string,
  ): BaseInternetAccountModel
}

export function isAppRootModel(thing: unknown): thing is AppRootModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'findAppropriateInternetAccount' in thing
  )
}

export interface RootModelWithInternetAccounts extends AbstractRootModel {
  internetAccounts: BaseInternetAccountModel[]
  findAppropriateInternetAccount(
    location: UriLocation,
  ): BaseInternetAccountModel | undefined
}

export function isRootModelWithInternetAccounts(
  thing: unknown,
): thing is RootModelWithInternetAccounts {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'internetAccounts' in thing &&
    'findAppropriateInternetAccount' in thing
  )
}

/** a root model that manages global menus */
export interface AbstractMenuManager {
  appendMenu(menuName: string): void
  insertMenu(menuName: string, position: number): number
  insertInMenu(menuName: string, menuItem: MenuItem, position: number): number
  appendToMenu(menuName: string, menuItem: MenuItem): number
  appendToSubMenu(menuPath: string[], menuItem: MenuItem): number
  insertInSubMenu(
    menuPath: string[],
    menuItem: MenuItem,
    position: number,
  ): number
}
export function isAbstractMenuManager(
  thing: unknown,
): thing is AbstractMenuManager {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'appendMenu' in thing &&
    'appendToSubMenu' in thing
  )
}

// Empty interfaces required by @jbrowse/mobx-state-tree
// See https://@jbrowse/mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoAssemblyRegion extends SnapshotIn<
  typeof MUNoAssemblyRegion
> {}

/**
 * a description of a specific genomic region. assemblyName, refName, start,
 * end, and reversed
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Region extends SnapshotIn<typeof MUIRegion> {}

export interface AugmentedRegion extends Region {
  originalRefName?: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LocalPathLocation extends SnapshotIn<
  typeof MULocalPathLocation
> {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UriLocation extends SnapshotIn<typeof MUUriLocation> {}

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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FileHandleLocation extends SnapshotIn<
  typeof MUFileHandleLocation
> {}

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
export class AuthNeededError extends Error {
  url: string

  constructor(message: string, url: string) {
    super(message)
    this.url = url
    this.name = 'AuthNeededError'

    Object.setPrototypeOf(this, AuthNeededError.prototype)
  }
}

export function isAuthNeededException(
  exception: unknown,
): exception is AuthNeededError {
  return (
    exception instanceof Error &&
    // DOMException
    (exception.name === 'AuthNeededError' ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (exception as AuthNeededError).url !== undefined)
  )
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BlobLocation extends SnapshotIn<typeof MUBlobLocation> {}

export type FileLocation =
  | LocalPathLocation
  | UriLocation
  | BlobLocation
  | FileHandleLocation

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

export { default as TextSearchManager } from '../../TextSearch/TextSearchManager.ts'
