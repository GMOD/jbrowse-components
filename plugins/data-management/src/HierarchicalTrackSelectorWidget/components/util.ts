import type { TreeNode } from '../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function getAllChildren(subtree?: TreeNode): AnyConfigurationModel[] {
  return subtree?.type === 'category'
    ? subtree.children.flatMap(t =>
        t.type === 'category' ? getAllChildren(t) : t.conf,
      )
    : []
}

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}
