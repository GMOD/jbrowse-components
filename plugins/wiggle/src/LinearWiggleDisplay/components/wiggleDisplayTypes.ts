import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WiggleFeatureUnderMouse } from '../../util.ts'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

export interface WiggleDisplayModel
  extends WiggleGpuDisplayModel, WiggleGpuProps {
  domain: [number, number] | undefined
  scaleType: string
  featureUnderMouse?: WiggleFeatureUnderMouse
  setFeatureUnderMouse: (feat?: WiggleFeatureUnderMouse) => void
  selectFeature: (feat: WiggleFeatureUnderMouse) => void
}
