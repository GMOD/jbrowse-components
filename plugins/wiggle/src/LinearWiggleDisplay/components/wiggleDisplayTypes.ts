import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

export interface WiggleDisplayModel
  extends WiggleGpuDisplayModel, WiggleGpuProps {
  domain: [number, number] | undefined
  scaleType: string
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
}
