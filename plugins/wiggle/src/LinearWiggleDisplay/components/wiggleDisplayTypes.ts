import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WiggleBackend } from '../../shared/wiggleBackendTypes.ts'
import type { WiggleDataResult } from '../../util.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

export interface WiggleDisplayModel extends WiggleGpuProps {
  rpcDataMap: Map<number, WiggleDataResult>
  height: number
  domain: [number, number] | undefined
  scaleType: string
  ticks?: YScaleTicks
  error: Error | null
  isLoading: boolean
  statusMessage?: string
  displayCrossHatches: boolean
  scalebarOverlapLeft: number
  featureUnderMouse?: {
    refName: string
    start: number
    end: number
    score: number
    minScore?: number
    maxScore?: number
    summary?: boolean
  }
  setFeatureUnderMouse: (feat?: WiggleDisplayModel['featureUnderMouse']) => void
  reload: () => void
  canvasDrawn: boolean
  isReady: boolean
  startGpuBackendLifecycle: (backend: WiggleBackend) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}
