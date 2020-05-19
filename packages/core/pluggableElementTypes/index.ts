import AdapterType from './AdapterType'
import ConnectionType from './ConnectionType'
import RendererType from './renderers/RendererType'
import DrawerWidgetType from './DrawerWidgetType'
import MenuBarType from './MenuBarType'
import TrackType from './TrackType'
import ViewType from './ViewType'

export type PluggableElementType =
  | AdapterType
  | ConnectionType
  | RendererType
  | DrawerWidgetType
  | MenuBarType
  | TrackType
  | ViewType

export type PluggableElementMember =
  | keyof AdapterType
  | keyof ConnectionType
  | keyof RendererType
  | keyof DrawerWidgetType
  | keyof MenuBarType
  | keyof TrackType
  | keyof ViewType
