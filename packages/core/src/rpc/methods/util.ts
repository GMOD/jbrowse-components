import type { ServerSideRendererType } from '../../pluggableElementTypes/index.ts'
import type RendererType from '../../pluggableElementTypes/renderers/RendererType.tsx'
import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType.ts'
import type { Region } from '../../util/index.ts'

export interface RenderArgs extends ServerSideRenderArgs {
  adapterConfig: Record<string, unknown>
  rendererType: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  assemblyName: string
  regions: Region[]
  adapterConfig: Record<string, unknown>
  rendererType: string
}

export function validateRendererType(
  rendererType: string,
  RendererTypeInstance: RendererType | undefined,
): ServerSideRendererType {
  if (!RendererTypeInstance?.ReactComponent) {
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  }
  return RendererTypeInstance as ServerSideRendererType
}

export {
  type RenderResults,
  type ResultsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType.ts'
