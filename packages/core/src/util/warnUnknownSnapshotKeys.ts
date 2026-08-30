import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

/**
 * Report a view snapshot key that names no declared property. MST drops one
 * without a word, so a config authoring
 * `{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr1:1-100' }` renders a
 * default view and says nothing about why. The known set is read off the
 * composed model, so it cannot drift as a view gains properties.
 *
 * ORDER: MST runs preprocessors in the reverse of the order they were added,
 * and a composed base's after all of them. So this belongs on the chain BEFORE
 * a view's own legacy-key `preProcessSnapshot`, where it sees the snapshot MST
 * finally consumes rather than reporting a converted legacy key as a typo.
 * `legacy` names what it still cannot see: the keys a composed base converts.
 */
export function warnUnknownSnapshotKeys<M extends IAnyModelType>(
  model: M,
  { legacy = [] }: { legacy?: readonly string[] } = {},
): M {
  const known = new Set([...Object.keys(model.properties), ...legacy])
  return model.preProcessSnapshot((snap: unknown) => {
    if (snap && typeof snap === 'object') {
      const unknown = Object.keys(snap).filter(key => !known.has(key))
      if (unknown.length) {
        const { type } = snap as { type?: unknown }
        console.error(
          `[jbrowse view contract] ${typeof type === 'string' ? type : model.name} ` +
            `snapshot names no declared property for key(s): ` +
            `${unknown.join(', ')}. MST drops these silently and the view ` +
            `loads at its defaults. A launch key (assembly, loc, tracks, …) ` +
            `goes inside \`init\`; anything meant to persist has to be ` +
            `declared as a property on the state model.`,
        )
      }
    }
    return snap
  }) as M
}
