export { App, AppReadyMarker, DialogQueue } from './ui/index.ts'
export { HistoryManagementMixin } from './HistoryManagement/index.ts'
export { DEFAULT_SHARE_URL, JBrowseConfigF } from './JBrowseConfig/index.ts'
export { JBrowseModelF } from './JBrowseModel/index.ts'
export { AssembliesMixin } from './Assemblies/index.ts'
export { AppSessionMixin } from './AppSession/index.ts'
export type { AppRootModel } from './AppSession/index.ts'
export { RootAppMenuMixin } from './RootMenu/index.ts'
export {
  WorkspaceLayoutMixin,
  isSessionWithWorkspaceLayout,
} from './WorkspaceLayout/index.ts'
export type {
  WorkspaceLayoutMixinType,
  WorkspaceLayout,
  LayoutTree,
  PanelNode,
  TabNode,
  // named by the emitted BaseWebSession/sessionModel declarations, whose
  // `applyLayoutSpec`/`setPendingMove`/`tileViews`/`findTab` signatures tsc
  // otherwise serializes as a `src/` path a published tarball doesn't ship
  LayoutSpecNode,
  PendingMove,
  TileMode,
  TabHome,
} from './WorkspaceLayout/index.ts'
export {
  addSessionTracks,
  buildLgvInit,
  buildLgvInitFromParams,
  hubConnectionSpec,
  loadSessionSpec,
  parseSessionSpecUrl,
  readHubUrlParam,
  readNavParam,
  readTracklistParam,
  shortHubLabel,
  splitHighlights,
} from './SessionSpec/index.ts'
export type {
  LayoutNode,
  LgvUrlInit,
  ParsedSessionSpec,
  ViewSpec,
} from './SessionSpec/index.ts'
export type { SessionModelFactory } from './sessionModelFactory.ts'
// URL params, for the two products that own their page (web, desktop). An
// embedded product must not rewrite its host's URL — see queryParams.ts
export {
  deleteQueryParams,
  readAllQueryParams,
  readQueryParams,
  setQueryParams,
  useQueryParam,
} from './queryParams.ts'
export { processMutableMenuActions, resolveMenus } from './menus.ts'
export type { Menu, MenuAction, MenuDefinition } from './menus.ts'
// The helper library an agent drives the app through: desktop serves it to
// run_javascript over MCP, web hands it to the page as window.jb
export {
  createJbApi,
  ensureReExports,
  safeJson,
  sessionOf,
  undeliveredNotifications,
  waitReady,
} from './JbApi/index.ts'
export type { JbApi } from './JbApi/index.ts'
