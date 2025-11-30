import type { ColorBy, ModificationTypeWithColor } from '../shared/types'
import type {
  RenderArgsDeserializedWithFeatures as WiggleRenderArgsDeserializedWithFeatures,
  ScaleOpts,
} from '@jbrowse/plugin-wiggle'

export interface RenderArgsDeserializedWithFeatures
  extends WiggleRenderArgsDeserializedWithFeatures {
  scaleOpts: ScaleOpts
  ticks: { values: number[] }
  displayCrossHatches: boolean
  visibleModifications?: Record<string, ModificationTypeWithColor>
  simplexModifications?: string[]
  colorBy: ColorBy
}
