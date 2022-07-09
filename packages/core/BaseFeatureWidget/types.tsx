import React from 'react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { SimpleFeatureSerialized } from '../util/simpleFeature'
import { AbstractViewModel } from '../util'

export interface BaseProps extends BaseCardProps {
  feature: SimpleFeatureSerialized
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
