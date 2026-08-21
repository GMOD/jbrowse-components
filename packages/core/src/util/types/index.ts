import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type TextSearchManager from '../../TextSearch/TextSearchManager.ts'
import type assemblyManager from '../../assemblyManager/index.ts'
import type {
  AnyConfigurationModel,
  ResolvableDisplay,
} from '../../configuration/index.ts'
import type { BaseInternetAccountModel } from '../../pluggableElementTypes/models/index.ts'
import type { PluginDefinition } from '../../pluginDefinitions.ts'
import type RpcManager from '../../rpc/RpcManager.ts'
import type { MenuItem, SerializableThemeArgs } from '../../ui/index.ts'
import type { JBrowsePalette } from '../../ui/palette.ts'
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

export type {
  AnyReactComponentType,
  ClassReturnedBy,
  InstanceTypeRestrictive,
  TypeTestedByPredicate,
} from './util.ts'
export type { IsAny } from './isAny.ts'

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
  // Free-form labels from the store manifest, used to filter the store list.
  // Deliberately `string[]` and not a union: the vocabulary lives in
  // jbrowse-plugin-list's plugins.json, so the store discovers whatever tags are
  // actually published rather than needing a release here to learn a new one.
  tags?: string[]
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
  // per-browser UI preference (localStorage-backed, stripped from snapshots by
  // MultipleViewsSessionMixin). Optional here rather than behind a guard: the
  // two readers — a view deciding whether to pin its own header, and the app
  // shell's ViewHeader — both want "false when the session has no such notion",
  // which is what a plain `=== true` read of an absent member already gives
  stickyViewHeaders?: boolean
  configuration: AnyConfigurationModel
  rpcManager: RpcManager
  assemblyNames: string[]
  assemblies: AnyConfigurationModel[]
  selection?: unknown
  focusedViewId?: string
  themeName?: string
  // `palette` is what rendering reads: plain color strings, no toolkit, and
  // serializable. `theme` is the Material UI theme for the components that are
  // Material UI. Both come from the same `resolvePalette` call, so they cannot
  // disagree.
  palette: JBrowsePalette
  theme: Theme
  themeOptions?: SerializableThemeArgs
  animationMode: AnimationMode
  scrollZoom: boolean
  // pacing for the scroll-to-zoom prompt, kept session-wide rather than per
  // view so a synteny view's three wheel surfaces can't interrupt three times
  // over — see BaseSessionModel's `canShowScrollZoomHint`
  canShowScrollZoomHint: boolean
  scrollZoomHintCount: number
  noteScrollZoomHintShown: () => void
  snoozeScrollZoomHints: () => void
  // whether region highlight bands (URL/view highlights and bookmark overlays)
  // are drawn; one session-wide toggle shared by all views
  highlightsVisible: boolean
  setHighlightsVisible: (arg: boolean) => void
  revealHighlights: () => void
  // The runtime user-preference store, all of it declared by `BaseSessionModel`
  // and therefore present on every session in every product — required, not
  // optional, so its readers (the promotable-default cascade, the scroll-zoom
  // toggles, the preferences dialog) call it plainly. `AssertSessionModel` on
  // each product's session model is what turns a member drifting out of this set
  // into a build error rather than a silently-skipped `?.` call.
  getPreference: (key: string) => unknown
  setPreferenceOverride: (key: string, value: unknown) => void
  clearPreferenceOverrides: () => void
  setScrollZoom: (flag: boolean) => void
  // per-display-type slot default a user promoted (e.g. "make compact the
  // default for all tracks like this"), persisted alongside preferences
  getDisplayTypeDefault: (displayType: string, slot: string) => unknown
  setDisplayTypeDefault: (
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
    // `SnackbarModel.notify` has always normalized an array here; this
    // declaration said singular, so the one caller that needs to offer a
    // choice (the promoted-default pin's two scopes) could not say so without
    // a cast. Widening, so every existing single-action caller still fits.
    action?: SnackAction | SnackAction[],
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

/**
 * abstract interface for a session that can swap one of its views for a new one
 * of another type, in the slot the old view occupied.
 *
 * Separate from AbstractViewContainer rather than an optional member on it: the
 * single-view embedded products implement addView by destructively replacing
 * their one view, which is the same words for a different contract — there is
 * no slot and nothing to name. Only a real multi-view container can offer this,
 * and the guard is what a launcher asks before offering it.
 */
export interface SessionWithViewReplacement extends AbstractSessionModel {
  replaceView(
    view: AbstractViewModel,
    typeName: string,
    initialState?: Record<string, unknown>,
  ): AbstractViewModel
}
export function isSessionWithViewReplacement(
  t: unknown,
): t is SessionWithViewReplacement {
  return isSessionModel(t) && 'replaceView' in t
}

/**
 * Whether `view` is a view a launcher can actually offer to swap out — i.e.
 * whether "Replace current view" would replace anything.
 *
 * Both halves are needed. The session must be able to replace a view at all,
 * and the view must be one of the session's OWN: a launcher resolves its source
 * with `getContainingView`, which inside a LinearSyntenyView (or a dotplot)
 * returns the row's inner LGV, and that view occupies no session slot. Replacing
 * it falls through to `addView`, so the button did what Submit does while saying
 * otherwise — the launched view appended below the untouched source. Asking this
 * instead leaves those cases with the one button that tells the truth.
 */
export function canReplaceView(
  session: AbstractSessionModel,
  view: AbstractViewModel | undefined,
): view is AbstractViewModel {
  return (
    view !== undefined &&
    isSessionWithViewReplacement(session) &&
    session.views.includes(view)
  )
}

/**
 * Open a launched view, either in the slot `replacing` occupies or appended.
 *
 * The branch every launcher that offers "Replace current view" would otherwise
 * write for itself, kept in one place with the guard it depends on. A session
 * that can't replace a view falls back to appending, so a caller passes the
 * source view unconditionally and never has to ask twice.
 */
export function addOrReplaceView({
  session,
  typeName,
  initialState,
  replacing,
}: {
  session: AbstractSessionModel
  typeName: string
  initialState?: Record<string, unknown>
  replacing?: AbstractViewModel
}) {
  return replacing && isSessionWithViewReplacement(session)
    ? session.replaceView(replacing, typeName, initialState)
    : session.addView(typeName, initialState)
}

/**
 * abstract interface for a session that can publish a track config to the
 * shared catalog on behalf of whoever is looking.
 *
 * The capability the "Add track" workflows need, and nothing else: an admin's
 * track goes into the config.json every visitor is served. A feature standing a
 * track up on the user's behalf wants `SessionWithAddSessionTrack` below —
 * every session has that one, so reaching for this is a statement about the
 * workflow rather than a fallback when the other is missing.
 */
export interface SessionWithPublishTrackConf extends AbstractSessionModel {
  // returns the added config, or undefined if it was invalid (surfaced as a
  // snackbar) — see SessionTracks.publishTrackConf
  publishTrackConf(
    configuration: AnyConfigurationModel | SnapshotIn<AnyConfigurationModel>,
  ): AnyConfigurationModel | undefined
}
export function isSessionWithPublishTrackConf(
  t: unknown,
): t is SessionWithPublishTrackConf {
  return (
    isSessionModel(t) &&
    'publishTrackConf' in t &&
    !('disableAddTracks' in t && t.disableAddTracks)
  )
}

/**
 * abstract interface for a session that keeps a user's own added/copied tracks
 * separate from the ones the config ships. `AbstractSessionModel` already
 * declares `sessionTracks` optionally; this is the narrowing a caller needs to
 * read it, and it lives here rather than in product-core so a plugin — in-tree
 * or external — can ask the question through the ABI it already depends on.
 */
export interface SessionWithSessionTracks extends AbstractSessionModel {
  sessionTracks: AnyConfigurationModel[]
}
export function isSessionWithSessionTracks(
  t: unknown,
): t is SessionWithSessionTracks {
  return isSessionModel(t) && 'sessionTracks' in t
}

/**
 * abstract interface for a session that can be given a track belonging to the
 * session itself.
 *
 * The default, and what a feature standing a track up on the user's behalf
 * wants: an admin opening a VCF in the SV inspector does not thereby mean to
 * publish it to every visitor. Every session mixin defines
 * `addSessionTrackConf`, so a false here means the host turned tracks off
 * (`disableAddTracks`) rather than that this product lacks a session scope —
 * the guard is about permission, not about capability.
 */
export interface SessionWithAddSessionTrack extends AbstractSessionModel {
  addSessionTrackConf(
    configuration: AnyConfigurationModel | SnapshotIn<AnyConfigurationModel>,
  ): AnyConfigurationModel | undefined
}
export function isSessionWithAddSessionTrack(
  t: unknown,
): t is SessionWithAddSessionTrack {
  return (
    isSessionModel(t) &&
    'addSessionTrackConf' in t &&
    !('disableAddTracks' in t && t.disableAddTracks)
  )
}

/**
 * @deprecated ask `isSessionWithAddSessionTrack` for a track a feature stands
 * up on the user's behalf, or `isSessionWithPublishTrackConf` in an Add-track
 * workflow.
 *
 * Kept because a prebuilt plugin bundle links it by name off
 * `JBrowseExports['@jbrowse/core/util']` and cannot be recompiled:
 * jbrowse-plugin-protein3d 0.8.0 gates its structure-track launch on it
 * (`(0,ll.isSessionWithAddTracks)(e)?e:void 0`), so dropping the export makes
 * the call `undefined is not a function` inside the menu builder rather than
 * failing a build. It answers the session-scoped question now, which is the one
 * that caller wanted — its launch goes on to `session.addTrackConf`, the
 * session-scoped alias. `graphgenomeviewer` does not reference either name.
 *
 * Nothing in tree may call it; `no-restricted-syntax` says so.
 */
export const isSessionWithAddTracks = isSessionWithAddSessionTrack

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

/**
 * the slice of a view that the track-selector and add-track widgets write into:
 * a track list, the assemblies it may show tracks for, and the open/close
 * actions. A plain view is its own track container; a view that owns several
 * (the synteny view's per-level track lists) hands them out via
 * `trackContainerFor`.
 */
export interface TrackContainer {
  tracks: {
    configuration: { trackId: string }
    displays: ResolvableDisplay[]
  }[]
  assemblyNames?: string[]
  /**
   * The trailing three are `showTrackGeneric`'s, and only the last has a caller
   * here: `addTrackFromWidget` passes a config the session must not keep. A
   * container that implements the one-argument form still satisfies this, and
   * drops the config — `showTrackGeneric` then finds no track by that id and
   * throws "Could not resolve identifier", which is a snackbar rather than a
   * silence.
   */
  showTrack: (
    trackId: string,
    initialSnapshot?: object,
    displayInitialSnapshot?: Record<string, unknown>,
    inlineConf?: Record<string, unknown>,
  ) => unknown
  hideTrack: (trackId: string) => unknown
  toggleTrack: (trackId: string) => unknown
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
  /**
   * a track container owned by this view, by its id. Only views holding more
   * than one track list implement it; for every other view the widget targets
   * the view itself.
   */
  trackContainerFor?: (id: string) => TrackContainer | undefined
  /**
   * every track container this view owns INSTEAD of a `tracks` array of its
   * own. The synteny view is the only one: its tracks hang off the levels, one
   * per band, so anything walking `view.tracks` to reach a display finds
   * nothing there and reads a still-fetching synteny view as idle.
   * `trackContainerFor` cannot answer that — a walker has no id to ask with.
   */
  trackContainers?: TrackContainer[]
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

/**
 * a root model that manages global menus. Every method records a contribution
 * that is applied when the menu opens, so none of them can report where the
 * item landed
 */
export interface AbstractMenuManager {
  appendMenu(menuName: string): void
  insertMenu(menuName: string, position: number): void
  insertInMenu(menuName: string, menuItem: MenuItem, position: number): void
  appendToMenu(menuName: string, menuItem: MenuItem): void
  appendToSubMenu(menuPath: string[], menuItem: MenuItem): void
  insertInSubMenu(
    menuPath: string[],
    menuItem: MenuItem,
    position: number,
  ): void
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
