import type AdapterType from './AdapterType.ts'
import type AddTrackWorkflowType from './AddTrackWorkflowType.ts'
import type ConnectionType from './ConnectionType.ts'
import type DisplayType from './DisplayType.ts'
import type InternetAccountType from './InternetAccountType.ts'
import type RpcMethodType from './RpcMethodType.ts'
import type TextSearchAdapterType from './TextSearchAdapterType.ts'
import type TrackType from './TrackType.ts'
import type ViewType from './ViewType.ts'
import type WidgetType from './WidgetType.ts'

export {
  BaseConnectionModelFactory,
  BaseDisplay,
  type BaseDisplayModel,
  type BaseDisplayStateModel,
  BaseInternetAccountConfig,
  type BaseInternetAccountModel,
  type BaseInternetAccountStateModel,
  type BaseTrackConfig,
  type BaseTrackModel,
  type BaseTrackStateModel,
  BaseViewModel,
  type DisplayModel,
  type FileTypeExporter,
  HighlightsMixin,
  type IBaseViewModel,
  InternetAccount,
  addDisplayConfigMigration,
  baseConnectionConfig,
  createBaseTrackConfig,
  createBaseTrackModel,
  preprocessTrackConfigSnapshot,
  type TrackConfigSnapshot,
  trackConfigActions,
} from './models/index.ts'

export type PluggableElementType =
  | AdapterType
  | ConnectionType
  | WidgetType
  | TrackType
  | DisplayType
  | ViewType
  | RpcMethodType
  | InternetAccountType
  | TextSearchAdapterType
  | AddTrackWorkflowType

export { extendDisplayType, extendViewType } from './extendElementType.ts'
export { addDisplayMenuItems, addViewMenuItems } from './addMenuItems.ts'
export { default as AdapterType } from './AdapterType.ts'
export { default as ConnectionType } from './ConnectionType.ts'
export { default as TrackType } from './TrackType.ts'
export { default as WidgetType } from './WidgetType.ts'
export { default as ViewType } from './ViewType.ts'
export { default as DisplayType } from './DisplayType.ts'
export { default as InternetAccountType } from './InternetAccountType.ts'

export { default as RpcMethodType } from './RpcMethodType.ts'
// The two region-renaming bases, which nearly every RPC method that takes a
// viewport wants — without them an external plugin deep-imports the file and
// bundles its own copy, which is only harmless because RPC methods are keyed by
// name (PluginManager.rpcMethods) and nothing does an instanceof.
// `RpcMethodTypeWithFiltersAndRenameRegions` is deliberately not here: it pulls
// in `renderers/util/serializableFilterChain`, and RFC-001 §9 deletes
// `pluggableElementTypes/renderers/*` after the legacy renderer migration. This
// barrel is served as ABI, so exporting it would pin a directory we intend to
// remove.
export { default as RpcMethodTypeWithRenameRegion } from './RpcMethodTypeWithRenameRegion.ts'
export { default as RpcMethodTypeWithRenameRegions } from './RpcMethodTypeWithRenameRegions.ts'
export { default as AddTrackWorkflowType } from './AddTrackWorkflowType.ts'
export type { AddTrackWorkflowCategory } from './AddTrackWorkflowType.ts'
export { default as TextSearchAdapterType } from './TextSearchAdapterType.ts'
