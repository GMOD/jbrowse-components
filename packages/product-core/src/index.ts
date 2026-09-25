export type { AssertExtends, AssertNotAny } from './assertExtends.ts'
export { asRoot, asSession } from './siblingCast.ts'
export { scheduleDetachedDestroy } from '@jbrowse/core/util'

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
  SYSTEM_THEME,
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
  bakeSessionCascades,
  getShareableSessionSnapshot,
  copyTrackSnapshot,
  finalizeSession,
  hydratedForms,
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
  HydratedForms,
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
  AppReadyMarker,
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
  AboutPanelProps,
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
  normalizeAdapterSnapshots,
  registerLocalFiles,
  resolveLocalFileUris,
} from './localFiles.ts'
export type { LocalFileInput } from './localFiles.ts'
export { searchIndexKey, withHostOverrides } from './controllerTracks.ts'
export type { TrackInput } from './controllerTracks.ts'
// the lifecycle behind each single-view product's imperative controller
export { createEmbeddedController } from './embeddedController.ts'
// hub names, sequence URIs and hub configs -> assembly configs, so every
// product takes the same assembly vocabulary
export { resolveAssemblies, resolveAssembly } from './resolveAssemblies.ts'
export type { AssemblyInput, ResolvedAssemblies } from './resolveAssemblies.ts'
// engine teardown, for a host that builds and discards engines — React unmount
// alone leaves the RPC workers and autoruns running
export { destroyViewState } from './destroyViewState.ts'
// the two halves of "React owns this engine", both of which have a StrictMode
// trap in them that the obvious spelling walks straight into
export {
  useAsyncEngineLifecycle,
  useCreateOnce,
  useCreateOnceAsync,
  useDestroyOnUnmount,
} from './useEngineLifecycle.ts'
// the JS -> host direction of an embedded controller: where each view is
// looking, what got selected, and the layout as plain JSON
export { getSessionSnapshot, observeSession } from './observeSession.ts'
export type { SessionObservers, ViewLocation } from './observeSession.ts'
export {
  migrateSessionSnapshot,
  migratedDisplayInstanceKeys,
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
  HostedBase,
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
export type { HeldNode, UnbuildableNode } from './pruneUnbuildableNodes.ts'
