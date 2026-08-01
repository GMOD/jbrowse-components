import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'
import type { BaseCardProps, Descriptors, FeatureFormatter } from '../types.tsx'

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: BaseFeatureWidgetModel
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}
