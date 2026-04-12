import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { BaseCardProps } from '../types.tsx'

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: IAnyStateTreeNode
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown, key: string) => React.ReactNode
}
