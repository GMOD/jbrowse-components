import type { ServerSideRendererType } from '../../pluggableElementTypes/index.ts'
import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType.tsx'
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

export function validateRendererType<T>(
  rendererType: string,
  RendererType: T,
): ServerSideRendererType {
  // @ts-expect-error
  if (!RendererType.ReactComponent) {
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  }
  return RendererType as unknown as ServerSideRendererType
}

export {
  type RenderResults,
  type ResultsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType.tsx'
