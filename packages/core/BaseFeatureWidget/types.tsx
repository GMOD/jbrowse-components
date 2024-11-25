import type React from 'react'
import type { BaseFeatureWidgetModel } from './stateModelFactory'
import type { SimpleFeatureSerialized } from '../util/simpleFeature'

export interface BaseProps extends BaseCardProps {
  feature: SimpleFeatureSerialized
  formatter?: (val: unknown, key: string) => React.ReactNode
  descriptions?: Record<string, React.ReactNode>
  model?: BaseFeatureWidgetModel
}

export interface BaseCardProps {
  title?: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}
