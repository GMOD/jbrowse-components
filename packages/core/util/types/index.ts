import {
  isStateTreeNode,
  Instance,
  SnapshotOut,
  SnapshotIn,
  IAnyStateTreeNode,
} from 'mobx-state-tree'
import PluginManager from '../../PluginManager'
import { AnyConfigurationModel } from '../../configuration/configurationSchema'

import assemblyManager from '../../assemblyManager'
import { MenuOption } from '../../ui'
import {
  NoAssemblyRegion as MUNoAssemblyRegion,
  Region as MUIRegion,
  LocalPathLocation as MULocalPathLocation,
  UriLocation as MUUriLocation,
} from './mst'
import RpcManager from '../../rpc/RpcManager'
import { Feature } from '../simpleFeature'

export * from './util'

/** abstract type for a model that contains multiple views */
export interface AbstractViewContainer {
  removeView(view: AbstractViewModel): void
  addView(typeName: string, initialState: Record<string, unknown>): void
}
export function isViewContainer(
  thing: unknown,
): thing is AbstractViewContainer {
  return isStateTreeNode(thing) && 'removeView' in thing
}

export type NotificationLevel = 'error' | 'info' | 'warning' | 'success'

export type AssemblyManager = Instance<ReturnType<typeof assemblyManager>>

/** minimum interface that all session state models must implement */
export interface AbstractSessionModel extends AbstractViewContainer {
  setSelection(feature: Feature): void
  clearSelection(): void
  configuration: AnyConfigurationModel
  pluginManager: PluginManager
  rpcManager: RpcManager
  assemblyNames: string[]
  assemblies: AnyConfigurationModel[]
  selection?: unknown
  duplicateCurrentSession(): void
  notify(message: string, level?: NotificationLevel): void
  assemblyManager: AssemblyManager
  version: string
}
export function isSessionModel(thing: unknown): thing is AbstractSessionModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'pluginManager' in thing &&
    'configuration' in thing
  )
}

/** abstract interface for a session allows editing configurations */
export interface SessionWithConfigEditing extends AbstractSessionModel {
  editConfiguration(configuration: AnyConfigurationModel): void
}
export function isSessionModelWithConfigEditing(
  thing: unknown,
): thing is SessionWithConfigEditing {
  return isSessionModel(thing) && 'editConfiguration' in thing
}

/** abstract interface for a session that manages widgets */
export interface SessionWithWidgets extends AbstractSessionModel {
  visibleWidget?: { id: string }
  widgets?: unknown[]
  addWidget(
    typeName: string,
    id: string,
    initialState?: Record<string, unknown>,
    configuration?: { type: string },
  ): void
  showWidget(widget: unknown): void
}
export function isSessionModelWithWidgets(
  thing: unknown,
): thing is SessionWithWidgets {
  return isSessionModel(thing) && 'widgets' in thing
}

/** abstract interface for a session that manages a global selection */
export interface SelectionContainer extends AbstractSessionModel {
  selection?: unknown
  setSelection: (thing: unknown) => void
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

/** minimum interface that all view state models must implement */
export interface AbstractViewModel {
  id: string
  showTrack(configuration: AnyConfigurationModel): void
  hideTrack(configuration: AnyConfigurationModel): void
}
export function isViewModel(thing: unknown): thing is AbstractViewModel {
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
  setDefaultSession(): void
  adminMode?: boolean
}

/** a root model that manages global menus */
export interface AbstractMenuManager {
  appendMenu(menuName: string): void
  insertMenu(menuName: string, position: number): number
  insertInMenu(menuName: string, menuItem: MenuOption, position: number): number
  appendToMenu(menuName: string, menuItem: MenuOption): number
  appendToSubMenu(menuPath: string[], menuItem: MenuOption): number
  insertInSubMenu(
    menuPath: string[],
    menuItem: MenuOption,
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
/* eslint-disable @typescript-eslint/no-empty-interface */

export interface NoAssemblyRegion
  extends SnapshotIn<typeof MUNoAssemblyRegion> {}

export interface Region extends SnapshotIn<typeof MUIRegion> {}

export interface LocalPathLocation
  extends SnapshotOut<typeof MULocalPathLocation> {}

export interface UriLocation extends SnapshotOut<typeof MUUriLocation> {}

export interface BlobLocation {
  blob: Blob
}

export type FileLocation = LocalPathLocation | UriLocation | BlobLocation

/* eslint-enable @typescript-eslint/no-empty-interface */
