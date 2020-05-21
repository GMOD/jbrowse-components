import AdapterType from './AdapterType'
import ConnectionType from './ConnectionType'
import RendererType from './renderers/RendererType'
import DrawerWidgetType from './DrawerWidgetType'
import TrackType from './TrackType'
import ViewType from './ViewType'
import RpcMethodType from './RpcMethodType'

export type PluggableElementType =
  | AdapterType
  | ConnectionType
  | RendererType
  | DrawerWidgetType
  | TrackType
  | ViewType
  | RpcMethodType

export type PluggableElementMember =
  | keyof AdapterType
  | keyof ConnectionType
  | keyof RendererType
  | keyof DrawerWidgetType
  | keyof TrackType
  | keyof ViewType
  | keyof RpcMethodType
