import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { TreeNode } from '../model'

export function getAllChildren(subtree?: TreeNode): AnyConfigurationModel[] {
  // @ts-ignore
  return (
    subtree?.children.map(t =>
      t.children.length ? getAllChildren(t) : (t.conf as AnyConfigurationModel),
    ) || []
  ).flat(Infinity)
}
