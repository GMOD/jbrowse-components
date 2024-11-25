/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type React from 'react'
import { isStateTreeNode } from 'mobx-state-tree'
import type {
  NoAssemblyRegion as MUNoAssemblyRegion,
  Region as MUIRegion,
  LocalPathLocation as MULocalPathLocation,
  UriLocation as MUUriLocation,
  BlobLocation as MUBlobLocation,
} from './mst'
import type TextSearchManager from '../../TextSearch/TextSearchManager'
import type assemblyManager from '../../assemblyManager'
import type { AnyConfigurationModel } from '../../configuration'
import type { BaseInternetAccountModel } from '../../pluggableElementTypes/models'
import type RpcManager from '../../rpc/RpcManager'
import type { MenuItem } from '../../ui'
import type { Feature } from '../simpleFeature'
// types
import type { ThemeOptions } from '@mui/material'
import type {
  Instance,
  SnapshotIn,
  IAnyStateTreeNode,
  IStateTreeNode,
  IType,
} from 'mobx-state-tree'

export * from './util'

/** abstract type for a model that contains multiple views */
export interface AbstractViewContainer
  extends IStateTreeNode<IType<any, any, any>> {
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
  name: React.ReactElement
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

/** minimum interface that all session state models must implement */
export interface AbstractSessionModel extends AbstractViewContainer {
  jbrowse: IAnyStateTreeNode
  drawerPosition?: string
  configuration: AnyConfigurationModel
  rpcManager: RpcManager
  assemblyNames: string[]
  assemblies: AnyConfigurationModel[]
  selection?: unknown
  focusedViewId?: string
  themeName?: string
  hovered: unknown
  setHovered: (arg: unknown) => void
  setFocusedViewId?: (id: string) => void
  allThemes?: () => Record<string, ThemeOptions>
  setSelection: (feature: Feature) => void
  setSession?: (arg: { name: string; [key: string]: unknown }) => void
  clearSelection: () => void
  duplicateCurrentSession?: () => void
  notify: (
    message: string,
    level?: NotificationLevel,
    action?: SnackAction,
  ) => void
  notifyError: (message: string, error?: unknown, extra?: unknown) => void
  assemblyManager: AssemblyManager
  version: string
  getTrackActionMenuItems?: Function
  addAssembly?: Function
  removeAssembly?: Function
  textSearchManager?: TextSearchManager
  connections: AnyConfigurationModel[]
  deleteConnection?: Function
  temporaryAssemblies?: unknown[]
  addTemporaryAssembly?: (arg: Record<string, unknown>) => void
  removeTemporaryAssembly?: (arg: string) => void
  sessionConnections?: AnyConfigurationModel[]
  sessionTracks?: AnyConfigurationModel[]
  connectionInstances?: {
    name: string
    tracks: AnyConfigurationModel[]
    configuration: AnyConfigurationModel
  }[]
  makeConnection?: Function
  breakConnection?: Function

  prepareToBreakConnection?: (arg: AnyConfigurationModel) => any
  adminMode?: boolean
  showWidget?: Function
  addWidget?: Function

  DialogComponent?: DialogComponentType

  DialogProps: any
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
export interface SessionWithConfigEditingModel extends AbstractSessionModel {
  editConfiguration(configuration: AnyConfigurationModel): void
}
export function isSessionModelWithConfigEditing(
  thing: unknown,
): thing is SessionWithConfigEditingModel {
  return isSessionModel(thing) && 'editConfiguration' in thing
}

/** abstract interface for a session allows adding tracks */
export interface SessionWithAddTracks extends AbstractSessionModel {
  addTrackConf(
    configuration: AnyConfigurationModel | SnapshotIn<AnyConfigurationModel>,
  ): void
}
export function isSessionWithAddTracks(
  thing: unknown,
): thing is SessionWithAddTracks {
  return (
    // @ts-expect-error
    isSessionModel(thing) && 'addTrackConf' in thing && !thing.disableAddTracks
  )
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
}

/** abstract interface for a session that manages widgets */
export interface SessionWithWidgets extends AbstractSessionModel {
  minimized: boolean
  visibleWidget?: Widget
  widgets: Map<string | number, Widget>
  activeWidgets: Map<string | number, Widget>
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
interface SessionWithConnections {
  makeConnection: (arg: AnyConfigurationModel) => void
}
export function isSessionModelWithConnections(
  thing: unknown,
): thing is SessionWithConnections {
  return isSessionModel(thing) && 'makeConnection' in thing
}

interface SessionWithConnectionEditing {
  addConnectionConf: (arg: AnyConfigurationModel) => void
}

export function isSessionModelWithConnectionEditing(
  thing: unknown,
): thing is SessionWithConnectionEditing {
  return isSessionModel(thing) && 'addConnectionConf' in thing
}

export interface SessionWithSessionPlugins extends AbstractSessionModel {
  sessionPlugins: JBrowsePlugin[]
  addSessionPlugin: Function
  removeSessionPlugin: Function
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
export interface SessionWithFocusedViewAndDrawerWidgets
  extends SessionWithDrawerWidgets {
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
}
export function isViewModel(thing: unknown): thing is AbstractViewModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'width' in thing &&
    'setWidth' in thing
  )
}

export interface AbstractTrackModel {
  displays: AbstractDisplayModel[]
  configuration: AnyConfigurationModel
}

export function isTrackModel(thing: unknown): thing is AbstractTrackModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'configuration' in thing &&
    // @ts-expect-error
    thing.configuration.trackId
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
    // @ts-expect-error
    thing.configuration.displayId
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

// Empty interfaces required by mobx-state-tree
// See https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoAssemblyRegion
  extends SnapshotIn<typeof MUNoAssemblyRegion> {}

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
export interface LocalPathLocation
  extends SnapshotIn<typeof MULocalPathLocation> {}

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
export class AuthNeededError extends Error {
  constructor(
    public message: string,
    public url: string,
  ) {
    super(message)
    this.name = 'AuthNeededError'

    Object.setPrototypeOf(this, AuthNeededError.prototype)
  }
}

export class RetryError extends Error {
  constructor(
    public message: string,
    public internetAccountId: string,
  ) {
    super(message)
    this.name = 'RetryError'
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

export function isRetryException(exception: Error): boolean {
  return (
    // DOMException
    exception.name === 'RetryError' ||
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (exception as RetryError).internetAccountId !== undefined
  )
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BlobLocation extends SnapshotIn<typeof MUBlobLocation> {}

export type FileLocation = LocalPathLocation | UriLocation | BlobLocation

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
export type PreFileLocation =
  | PreUriLocation
  | PreLocalPathLocation
  | PreBlobLocation

export { default as TextSearchManager } from '../../TextSearch/TextSearchManager'
