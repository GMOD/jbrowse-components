import { getDependencyTree } from 'mobx'

import type { IDependencyTree } from 'mobx'

declare const process: { env: { NODE_ENV?: string } }

const registry = new WeakMap<object, Map<string, () => void>>()

/**
 * Dev-only. Records a named reaction against the node it belongs to, so a test
 * can ask for its dependency set by name. Every autorun installer in the tree
 * calls this; a display's afterAttach discards the disposer, and this is the
 * one place it can still be found.
 */
export function recordNamedReaction(
  self: object,
  name: string,
  disposer: () => void,
) {
  if (process.env.NODE_ENV !== 'production') {
    const forNode = registry.get(self)
    if (forNode) {
      forNode.set(name, disposer)
    } else {
      registry.set(self, new Map([[name, disposer]]))
    }
  }
}

function leaves(tree: IDependencyTree, out: Set<string>) {
  if (tree.dependencies?.length) {
    for (const d of tree.dependencies) {
      leaves(d, out)
    }
  } else {
    out.add(tree.name)
  }
  return out
}

/**
 * The observables a named reaction currently subscribes to, as sorted leaf
 * names (`Model.prop`), computeds flattened to what they read. This is the
 * dependency set MobX rebuilt on the reaction's last run, so it answers, for
 * that state, the question no pure function can: which reads are tracked.
 */
export function reactionDependencies(self: object, name: string) {
  const disposer = registry.get(self)?.get(name)
  if (!disposer) {
    throw new Error(
      `no reaction named ${name} recorded on this node; known: ${[
        ...(registry.get(self)?.keys() ?? []),
      ].join(', ')}`,
    )
  }
  return [...leaves(getDependencyTree(disposer), new Set())].sort()
}
