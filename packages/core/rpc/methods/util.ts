import ServerSideRendererType, {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType'
import { Region } from '../../util'

export interface RenderArgs extends ServerSideRenderArgs {
  adapterConfig: {}
  rendererType: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  assemblyName: string
  regions: Region[]
  adapterConfig: {}
  rendererType: string
}

export type { RenderResults, ResultsSerialized }

export function validateRendererType<T>(rendererType: string, RendererType: T) {
  if (!RendererType) {
    throw new Error(`renderer "${rendererType}" not found`)
  }
  // @ts-ignore
  if (!RendererType.ReactComponent) {
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  }

  if (!(RendererType instanceof ServerSideRendererType)) {
    throw new Error(
      'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
    )
  }
  return RendererType
}
