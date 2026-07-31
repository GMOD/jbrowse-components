import type { BaseCardProps, Descriptors, FeatureFormatter } from '../types.tsx'
import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: BaseFeatureWidgetModel
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}
