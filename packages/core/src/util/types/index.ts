import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { PluginDefinition } from '../../PluginLoader.ts'
import type TextSearchManager from '../../TextSearch/TextSearchManager.ts'
import type assemblyManager from '../../assemblyManager/index.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { BaseInternetAccountModel } from '../../pluggableElementTypes/models/index.ts'
import type RpcManager from '../../rpc/RpcManager.ts'
import type { MenuItem, SerializableThemeArgs } from '../../ui/index.ts'
import type { Feature } from '../simpleFeature.ts'
import type { TrackConfigChange } from '../trackConfigDelta.ts'
import type {
  BlobLocation as MUBlobLocation,
  FileHandleLocation as MUFileHandleLocation,
  Region as MUIRegion,
  LocalPathLocation as MULocalPathLocation,
  NoAssemblyRegion as MUNoAssemblyRegion,
  UriLocation as MUUriLocation,
} from './mst.ts'
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
  Instance,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'
import type { Theme, ThemeOptions } from '@mui/material'
import type React from 'react'

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

/**
 * controls feature-layout animations. 'system' respects the OS
 * prefers-reduced-motion setting, 'enabled' always animates, 'disabled' never
 * animates
 */
export type AnimationMode = 'system' | 'enabled' | 'disabled'

/** minimum interface that all session state models must implement */
export interface AbstractSessionModel extends AbstractViewContainer {
  getTrackById: (id: string) => AnyConfigurationModel | undefined
  /** @deprecated prefer the per-id reactive `getTrackById(id)` */
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
  theme: Theme
  themeOptions?: SerializableThemeArgs
  animationMode: AnimationMode
  scrollZoom: boolean
  // whether region highlight bands (URL/view highlights and bookmark overlays)
  // are drawn; one session-wide toggle shared by all views
  highlightsVisible: boolean
  setHighlightsVisible: (arg: boolean) => void
  revealHighlights: () => void
  getPreference: (key: string) => unknown
  setPreferenceOverride?: (key: string, value: unknown) => void
  clearPreferenceOverrides?: () => void
  setScrollZoom?: (flag: boolean) => void
  // per-display-type slot default a user promoted (e.g. "make compact the
  // default for all tracks like this"), persisted alongside preferences
  getDisplayTypeDefault?: (displayType: string, slot: string) => unknown
  setDisplayTypeDefault?: (
    displayType: string,
    slot: string,
    value: unknown,
  ) => void
  hovered: unknown
  setHovered: (arg: unknown) => void
  setFocusedViewId?: (id: string) => void
  allThemes?: () => Record<string, ThemeOptions & { name?: string }>
  getActiveThemeOptions?: (
    name?: string,
  ) => (ThemeOptions & { name?: string }) | undefined
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
  trackConfigDeltas?: Record<
    string,
    { trackId: string; [key: string]: unknown }
  >
  // effective per-track config edits vs the base, and the action that drops them
  // (web session only; see SessionTracks / trackConfigDeltas)
  getTrackConfigChanges?: (trackId: string) => TrackConfigChange[]
  resetTrackConfiguration?: (trackId: string) => void
  connectionInstances?: ConnectionInstance[]
  connectionTrackConfigs?: Record<
    string,
    { connectionId: string; config: Record<string, unknown> }
  >
  makeConnection?: (arg: AnyConfigurationModel) => void
  breakConnection?: (arg: AnyConfigurationModel) => void
  captureConnectionTrack?: (trackId: string) => void
  pruneConnectionTrackConfig?: (trackId: string) => void
  hydrateConnection?: (connectionId: string) => void
  adminMode: boolean
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
  // → a shareable delta in trackConfigDeltas against the same-id base config)
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

/** abstract interface for a session that allows adding session assemblies */
export interface SessionWithAddAssembly extends AbstractSessionModel {
  addSessionAssembly(conf: Record<string, unknown>): void
}
export function isSessionWithAddAssembly(
  t: unknown,
): t is SessionWithAddAssembly {
  return isSessionModel(t) && typeof t.addSessionAssembly === 'function'
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
  /** true while the visible widget is shown in a modal instead of the drawer */
  poppedOut: boolean
  popoutWidget(): void
  returnWidgetToDrawer(): void
}

export function isSessionModelWithWidgets(
  thing: unknown,
): thing is SessionWithWidgets {
  return isSessionModel(thing) && 'widgets' in thing
}
/** a live connection instance held in a session's `connectionInstances` */
export interface ConnectionInstance {
  name: string
  connectionId: string
  tracks: AnyConfigurationModel[]
  configuration: AnyConfigurationModel
  // true while the connection is fetching its tracks
  loading: boolean
}
/** a session that can turn connections on and off */
export interface SessionWithConnections extends AbstractSessionModel {
  connectionInstances: ConnectionInstance[]
  makeConnection: (arg: AnyConfigurationModel) => void
  breakConnection: (arg: AnyConfigurationModel) => void
  deleteConnection: (arg: AnyConfigurationModel) => void
}
export function isSessionModelWithConnections(
  thing: unknown,
): thing is SessionWithConnections {
  return isSessionModel(thing) && 'makeConnection' in thing
}

/** a session that can also add new connection configs */
export interface SessionWithConnectionEditing extends SessionWithConnections {
  addConnectionConf: (arg: AnyConfigurationModel) => AnyConfigurationModel
}
export function isSessionModelWithConnectionEditing(
  thing: unknown,
): thing is SessionWithConnectionEditing {
  return isSessionModel(thing) && 'addConnectionConf' in thing
}

export interface SessionWithSessionPlugins extends AbstractSessionModel {
  sessionPlugins: (PluginDefinition & { name: string })[]
  addSessionPlugin: (plugin: PluginDefinition & { name: string }) => void
  removeSessionPlugin: (plugin: PluginDefinition) => void
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
  cannotBeRenderedReason?: string
  // Effective config differences a session-wide displayTypeDefault imposes on
  // this display (distinct from per-track config edits / trackConfigDeltas).
  // Empty when the resolved value equals the configured one. Optional: only
  // display types that participate in displayTypeDefaults implement it.
  displayTypeDefaultChanges?: () => TrackConfigChange[]
  // Clear the session-wide defaults reported by displayTypeDefaultChanges so this
  // display (and its siblings of the same type) revert to their config values.
  clearDisplayTypeDefaults?: () => void
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
  adminMode: boolean
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
  /* oxlint-disable typescript/no-unnecessary-condition -- intentional runtime guard: tsgolint sees these branches as unreachable but the input is genuinely unknown at runtime */
  return (
    exception instanceof Error &&
    // DOMException
    (exception.name === 'AuthNeededError' ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (exception as AuthNeededError).url !== undefined)
  )
  /* oxlint-enable typescript/no-unnecessary-condition */
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
