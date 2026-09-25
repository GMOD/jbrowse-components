import type { MenuItem } from '../ui/MenuTypes.ts'
import type { SimpleFeatureSerialized } from '../util/simpleFeature.ts'
import type {
  SequenceFeatureDetailsModel,
  SequenceHoverTarget,
} from './SequenceFeatureDetails/model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

// What the feature-details panels read off the widget they are drawn in. A duck
// type rather than `BaseFeatureWidgetModel`: every widget composing the base
// model overrides the `type` literal, which makes the composed instance
// non-assignable to the base, while each still carries these.
export interface FeatureDetailsModel
  extends IStateTreeNode, SequenceHoverTarget {
  maxDepth: number | undefined
  sequenceFeatureDetails: SequenceFeatureDetailsModel
  view: { assemblyNames: string[] } | undefined
}

// recursive to allow tagging nested data attributes
export interface Descriptors {
  [key: string]: React.ReactNode | Descriptors
}

export type FeatureFormatter = (
  value: unknown,
  key: string,
  index?: number,
) => React.ReactNode

/** Menu items for one attribute's value, offered from a button on its row. */
export type FieldActions = (path: string[], value: unknown) => MenuItem[]

export interface BaseProps extends BaseCardProps {
  feature: SimpleFeatureSerialized
  formatter?: FeatureFormatter
  descriptions?: Descriptors
}

export interface BaseCardProps {
  title?: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}

export type MaybeSerializedFeat = SimpleFeatureSerialized | undefined
