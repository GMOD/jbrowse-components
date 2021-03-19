import { IAnyStateTreeNode } from 'mobx-state-tree'
import { SimpleFeatureSerialized } from '../util/simpleFeature'

export interface BaseProps extends BaseCardProps {
  feature: SimpleFeatureSerialized & {
    start: number
    end: number
    refName: string
  }
  descriptions?: Record<string, React.ReactNode>
  model?: IAnyStateTreeNode
}

export interface BaseCardProps {
  title?: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}
