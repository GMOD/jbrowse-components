import type { BaseCardProps, FeatureFormatter } from '../types.tsx'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: IAnyStateTreeNode
  descriptions?: Record<string, React.ReactNode>
  formatter?: FeatureFormatter
}
