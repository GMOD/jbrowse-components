import AdapterType from './AdapterType'
import ConnectionType from './ConnectionType'
import RendererType from './renderers/RendererType'
import WidgetType from './WidgetType'
import TrackType from './TrackType'
import DisplayType from './DisplayType'
import ViewType from './ViewType'
import RpcMethodType from './RpcMethodType'
import TextSearchAdapter from './TextSearchAdapterType'

export type PluggableElementType =
  | AdapterType
  | ConnectionType
  | RendererType
  | WidgetType
  | TrackType
  | DisplayType
  | ViewType
  | RpcMethodType
  | TextSearchAdapter

export type PluggableElementMember =
  | keyof AdapterType
  | keyof ConnectionType
  | keyof RendererType
  | keyof WidgetType
  | keyof TrackType
  | keyof DisplayType
  | keyof ViewType
  | keyof RpcMethodType
  | keyof TextSearchAdapter
