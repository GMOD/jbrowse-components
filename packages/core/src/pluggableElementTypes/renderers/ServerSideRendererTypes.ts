import type { RenderProps, RenderResults } from './RendererType.tsx'
import type SerializableFilterChain from './util/serializableFilterChain.ts'
import type { SerializedFilterChain } from './util/serializableFilterChain.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { LastStopTokenCheck } from '../../util/stopToken.ts'
import type { SnapshotIn, SnapshotOrInstance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

interface BaseRenderArgs extends RenderProps {
  sessionId: string
  trackInstanceId: string
  stopToken?: string
  theme: ThemeOptions
  exportSVG?: {
    rasterizeLayers?: boolean
  }
}

export interface RenderArgs extends BaseRenderArgs {
  config: SnapshotOrInstance<AnyConfigurationModel>
  filters?: SerializableFilterChain
  renderingProps?: Record<string, unknown>
}

export interface RenderArgsSerialized extends BaseRenderArgs {
  statusCallback?: (arg: string) => void
  config: SnapshotIn<AnyConfigurationModel>
  filters?: SerializedFilterChain
}
export interface RenderArgsDeserialized extends BaseRenderArgs {
  config: AnyConfigurationModel
  filters?: SerializableFilterChain
  stopTokenCheck?: LastStopTokenCheck
}

export type ResultsSerialized = Omit<RenderResults, 'reactElement'> & {
  imageData?: ImageBitmap
}

export interface ResultsSerializedSvgExport extends ResultsSerialized {
  canvasRecordedData: unknown
  width: number
  height: number
  reactElement: unknown
}

export type ResultsDeserialized = RenderResults
