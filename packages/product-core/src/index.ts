export type { AssertExtends, AssertNotAny } from './assertExtends.ts'
export { asRoot, asSession } from './siblingCast.ts'
export { scheduleDetachedDestroy } from './scheduleDetachedDestroy.ts'

export {
  BaseRootModelFactory,
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
  InternetAccountsRootModelMixin,
  PreferencesConfigSchemaFactory,
  createConfigModel,
  exportSessionMenuItem,
  importSessionMenuItem,
  isRootModel,
  newSessionMenuItem,
  openConnectionMenuItem,
  openTrackMenuItem,
  pluginStoreMenuItem,
  preferencesMenuItem,
  redoMenuItem,
  undoMenuItem,
  workspacesMenuItem,
} from './RootModel/index.ts'
export type {
  BaseRootModel,
  BaseRootModelType,
  RootConfigurationSnapshot,
  RootModelWithInternetAccounts,
  RootModelWithInternetAccountsType,
} from './RootModel/index.ts'

export {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DrawerWidgetSessionMixin,
  MultipleViewsSessionMixin,
  PreferencesSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  ThemeManagerSessionMixin,
  TrackMenuItemsSessionMixin,
  TrackMenuSessionMixin,
  TracksManagerSessionMixin,
  aboutTrackMenuItem,
  bakePromotedDefaultsIntoSnapshot,
  bakeSessionCascades,
  getShareableSessionSnapshot,
  copyTrackSnapshot,
  finalizeSession,
  isBaseSession,
  isSession,
  isSessionWithConnections,
  isSessionWithDrawerWidgets,
  isSessionWithMultipleViews,
  isSessionWithReferenceManagement,
  isSessionWithThemes,
  isSessionWithTracks,
  pluginExtraTrackItems,
  trackActionItems,
  trackActionMenuItems,
  trackListMenuItems,
} from './Session/index.ts'
export type {
  AssertSessionModel,
  BaseSession,
  BaseSessionType,
  ConnectionTrackConfigEntry,
  EditableTrackConfig,
  PlainTrackConfig,
  ReferringNode,
  SessionWithConnections,
  SessionWithConnectionsType,
  SessionWithDrawerWidgets,
  SessionWithDrawerWidgetsType,
  SessionWithMultipleViews,
  SessionWithMultipleViewsType,
  SessionWithReferenceManagement,
  SessionWithReferenceManagementType,
  SessionWithSessionTracks,
  SessionWithSessionTracksType,
  SessionWithThemes,
  SessionWithThemesType,
  SessionWithTracks,
  SessionWithTracksType,
} from './Session/index.ts'

export {
  AboutDialog,
  Drawer,
  DrawerControls,
  DrawerHeader,
  DrawerWidget,
  DrawerWidgetSelector,
  ModalWidget,
  ModalWidgetAppBar,
  PreferencesDialog,
  WidgetBody,
  WidgetHeading,
  drawerGridTemplateColumns,
} from './ui/index.ts'
export type {
  PreferencesDialogSession,
  PreferencesPanelDescriptor,
} from './ui/index.ts'

export { initializeWorker } from './rpcWorker.ts'
export { toPluginLoadRecord } from './pluginInput.ts'
export type { PluginInput } from './pluginInput.ts'
export { loadRuntimePlugins } from './loadPlugins.ts'
export type { LoadPluginsArgs } from './loadPlugins.ts'
export { decodeSessionFromUrl, encodeSessionToUrl } from './sessionUrl.ts'
export type { SessionSnapshot } from './sessionUrl.ts'
// in-memory files as tracks, for hosts whose data lives in a process rather
// than at a URL (a notebook kernel, an R session) — read by byte range, so an
// indexed file stays indexed
export {
  mergeLocalFiles,
  normalizeAdapterSnapshots,
  registerLocalFiles,
  resolveLocalFileUris,
} from './localFiles.ts'
export type { LocalFileInput } from './localFiles.ts'
// the track half of an imperative controller: loose track specs -> configs, and
// opening exactly the wanted set
export {
  isLooseTrack,
  mergeSearchAdapters,
  openTracks,
  reconcileTracks,
  resolveTracks,
  withAssemblyName,
} from './controllerTracks.ts'
export type {
  ControllerSession,
  TrackConf,
  TrackInput,
} from './controllerTracks.ts'
// hub names, sequence URIs and hub configs -> assembly configs, so every
// product takes the same assembly vocabulary
export { resolveAssemblies, resolveAssembly } from './resolveAssemblies.ts'
export type { AssemblyInput, ResolvedAssemblies } from './resolveAssemblies.ts'
// engine teardown, for a host that builds and discards engines — React unmount
// alone leaves the RPC workers and autoruns running
export { destroyViewState } from './destroyViewState.ts'
// the two halves of "React owns this engine", both of which have a StrictMode
// trap in them that the obvious spelling walks straight into
export { useCreateOnce, useDestroyOnUnmount } from './useEngineLifecycle.ts'
// the JS -> host direction of an embedded controller: where each view is
// looking, what got selected, and the layout as plain JSON
export { getSessionSnapshot, observeSession } from './observeSession.ts'
export type { SessionObservers, ViewLocation } from './observeSession.ts'
export {
  MIGRATED_DISPLAY_INSTANCE_KEYS,
  migrateConfigSnapshot,
  migrateSessionSnapshot,
} from './sessionMigrations/index.ts'
export {
  DEFAULT_WEB_BASE_URL,
  analyzeWebPortability,
  buildWebExportUrl,
  filterSessionInPlace,
  planWebExport,
} from './sessionUtils.ts'
export type {
  AssemblySnapshot,
  DroppedSessionNode,
  HostedBaseConfig,
  NonPortableLocation,
  SelfContainedReason,
  TrackSnapshot,
  WebExportInput,
  WebExportPlan,
  WebPortabilityReport,
} from './sessionUtils.ts'
export {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from './pruneUnbuildableNodes.ts'
export type { UnbuildableNode } from './pruneUnbuildableNodes.ts'
