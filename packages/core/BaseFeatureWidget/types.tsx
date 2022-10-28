import React from 'react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { SimpleFeatureSerializedNoId } from '../util/simpleFeature'
import { AbstractViewModel } from '../util'

export interface BaseProps extends BaseCardProps {
  feature: SimpleFeatureSerializedNoId
  formatter?: (val: unknown, key: string) => React.ReactNode
  descriptions?: Record<string, React.ReactNode>
  model?: IAnyStateTreeNode & {
    view?: AbstractViewModel & {
      assemblyNames?: string[]
    }
  }
}

export interface BaseCardProps {
  title?: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}
