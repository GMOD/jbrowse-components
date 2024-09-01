import AdapterType from './AdapterType'
import ConnectionType from './ConnectionType'
import RendererType from './renderers/RendererType'
import WidgetType from './WidgetType'
import TrackType from './TrackType'
import DisplayType from './DisplayType'
import ViewType from './ViewType'
import RpcMethodType from './RpcMethodType'
import InternetAccountType from './InternetAccountType'
import TextSearchAdapterType from './TextSearchAdapterType'
import AddTrackWorkflowType from './AddTrackWorkflowType'

export * from './renderers'
export * from './models'

export type PluggableElementType =
  | AdapterType
  | ConnectionType
  | RendererType
  | WidgetType
  | TrackType
  | DisplayType
  | ViewType
  | RpcMethodType
  | InternetAccountType
  | TextSearchAdapterType
  | AddTrackWorkflowType

export type PluggableElementMember =
  | keyof AdapterType
  | keyof ConnectionType
  | keyof RendererType
  | keyof WidgetType
  | keyof TrackType
  | keyof DisplayType
  | keyof ViewType
  | keyof RpcMethodType
  | keyof InternetAccountType
  | keyof TextSearchAdapterType
  | keyof AddTrackWorkflowType

export { default as AdapterType } from './AdapterType'
export { default as RendererType } from './renderers/RendererType'
export { default as ConnectionType } from './ConnectionType'
export { default as TrackType } from './TrackType'
export { default as WidgetType } from './WidgetType'
export { default as ViewType } from './ViewType'
export { default as DisplayType } from './DisplayType'
export { default as InternetAccountType } from './InternetAccountType'

export { default as RpcMethodType } from './RpcMethodType'
export { default as AddTrackWorkflowType } from './AddTrackWorkflowType'
export { default as TextSearchAdapterType } from './TextSearchAdapterType'
