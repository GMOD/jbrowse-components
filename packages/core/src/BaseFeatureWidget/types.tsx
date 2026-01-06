import type React from 'react'

import type { BaseFeatureWidgetModel } from './stateModelFactory.ts'
import type { SimpleFeatureSerialized } from '../util/simpleFeature.ts'

// recursive to allow tagging nested data attributes
export interface Descriptors {
  [key: string]: React.ReactNode | Descriptors
}

export interface BaseProps extends BaseCardProps {
  feature: SimpleFeatureSerialized
  formatter?: (val: unknown, key: string) => React.ReactNode
  descriptions?: Descriptors
  model?: BaseFeatureWidgetModel
}

export interface BaseCardProps {
  title?: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}

export interface SerializedFeat {
  [key: string]: unknown
  subfeatures?: Record<string, unknown>[]
}

export type MaybeSerializedFeat = SimpleFeatureSerialized | undefined
