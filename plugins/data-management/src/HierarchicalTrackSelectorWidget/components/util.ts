import type { TreeNode } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function getAllChildren(subtree?: TreeNode): AnyConfigurationModel[] {
  if (subtree?.type === 'category' || subtree?.type === 'supertrack') {
    return subtree.children.flatMap(t =>
      t.type === 'category' || t.type === 'supertrack'
        ? getAllChildren(t)
        : t.conf,
    )
  }
  return []
}

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}
