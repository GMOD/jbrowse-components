import React from 'react'
import { SimpleFeatureSerialized } from '../util/simpleFeature'
import { BaseFeatureWidgetModel } from './stateModelFactory'

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
