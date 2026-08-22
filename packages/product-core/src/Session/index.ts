export {
  ReferenceManagementSessionMixin,
  isSessionWithReferenceManagement,
} from './ReferenceManagement.ts'
export type {
  ReferringNode,
  SessionWithReferenceManagement,
  SessionWithReferenceManagementType,
} from './ReferenceManagement.ts'
export {
  ConnectionManagementSessionMixin,
  isSessionWithConnections,
} from './Connections.ts'
export type {
  ConnectionTrackConfigEntry,
  SessionWithConnections,
  SessionWithConnectionsType,
} from './Connections.ts'
export {
  DrawerWidgetSessionMixin,
  isSessionWithDrawerWidgets,
} from './DrawerWidgets.ts'
export type {
  SessionWithDrawerWidgets,
  SessionWithDrawerWidgetsType,
} from './DrawerWidgets.ts'
export { ThemeManagerSessionMixin, isSessionWithThemes } from './Themes.ts'
export type { SessionWithThemes, SessionWithThemesType } from './Themes.ts'
export { TracksManagerSessionMixin, isSessionWithTracks } from './Tracks.ts'
export type { SessionWithTracks, SessionWithTracksType } from './Tracks.ts'
export {
  MultipleViewsSessionMixin,
  isSessionWithMultipleViews,
} from './MultipleViews.ts'
export type {
  SessionWithMultipleViews,
  SessionWithMultipleViewsType,
} from './MultipleViews.ts'
export { PreferencesSessionMixin } from './Preferences.ts'
export { BaseSessionModel, isBaseSession, isSession } from './BaseSession.ts'
export type { BaseSession, BaseSessionType } from './BaseSession.ts'
export { SessionTracksManagerSessionMixin } from './SessionTracks.ts'
export type {
  EditableTrackConfig,
  PlainTrackConfig,
  SessionWithSessionTracks,
  SessionWithSessionTracksType,
} from './SessionTracks.ts'
export {
  bakePromotedDefaultsIntoSnapshot,
  bakeSessionCascades,
  getShareableSessionSnapshot,
} from './shareableSnapshot.ts'
export {
  TrackMenuItemsSessionMixin,
  aboutTrackMenuItem,
  copyTrackSnapshot,
  pluginExtraTrackItems,
  trackActionItems,
  trackActionMenuItems,
  trackListMenuItems,
} from './TrackMenu.ts'
export { TrackMenuSessionMixin } from './TrackMenuSessionMixin.ts'
export { finalizeSession } from './finalizeSession.ts'
export type { AssertSessionModel } from './assertSessionModel.ts'
