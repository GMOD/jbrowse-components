import AdapterType from './AdapterType'
import ConnectionType from './ConnectionType'
import RendererType from './renderers/RendererType'
import WidgetType from './WidgetType'
import TrackType from './TrackType'
import ViewType from './ViewType'
import RpcMethodType from './RpcMethodType'

export type PluggableElementType =
  | AdapterType
  | ConnectionType
  | RendererType
  | WidgetType
  | TrackType
  | ViewType
  | RpcMethodType

export type PluggableElementMember =
  | keyof AdapterType
  | keyof ConnectionType
  | keyof RendererType
  | keyof WidgetType
  | keyof TrackType
  | keyof ViewType
  | keyof RpcMethodType
