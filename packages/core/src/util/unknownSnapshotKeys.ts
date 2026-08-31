import { getType, types } from '@jbrowse/mobx-state-tree'

import { getNotificationSink } from './sessionServices.ts'

import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

const BUCKET = 'unknownSnapshotKeys'

interface CaptureHost extends IStateTreeNode {
  type?: string
  unknownSnapshotKeys?: Record<string, unknown>
}

/** what a diagnostic calls the view: its snapshot `type`, or the model name */
export function viewLabel(self: IStateTreeNode) {
  return (self as CaptureHost).type ?? getType(self).name
}

/**
 * What every surface calls this mistake. A session spec launches a view without
 * ever building a snapshot, so it classifies its own keys and reports them
 * through its own session rather than through the sink below — one wording, so
 * a typo reads the same whether it was written in a config or in a URL.
 */
export function unknownKeysMessage(label: string, keys: string[]) {
  return `${label} ignored unknown key(s): ${keys.join(', ')}`
}

/**
 * Name the keys a view was handed and could not place. Shared with
 * `withLaunchInput`, whose partition subsumes the capture below for any view
 * that registers launch keys, so the two say the same thing about the same
 * mistake.
 */
export function reportUnknownKeys(self: IStateTreeNode, keys: string[]) {
  if (!keys.length) {
    return
  }
  const message = unknownKeysMessage(viewLabel(self), keys)
  console.warn(message)
  try {
    getNotificationSink(self).notify(message, 'warning')
  } catch {
    // a view built outside a session has nowhere to put it
  }
}

/**
 * Name the row lists a view refused whole. `withLaunchInput` splits an authored
 * array into the recipes a launcher resolves and the built snapshots MST
 * restores, per entry — but a row list is indexed against the view's `levels`
 * and per-level tracks, so a list holding both kinds has no correct split and
 * is refused rather than renumbered.
 */
export function reportMalformedRows(self: IStateTreeNode, keys: string[]) {
  if (!keys.length) {
    return
  }
  const message = `${viewLabel(self)} refused ${keys.join(', ')}: the list mixes built view snapshots with recipes to open one, and the rows index against the levels between them. Write all of them one way.`
  console.warn(message)
  try {
    getNotificationSink(self).notify(message, 'warning')
  } catch {
    // a view built outside a session has nowhere to put it
  }
}

/**
 * Keep the view snapshot keys MST would otherwise drop without a word, so
 * attaching the view can name them. A config authoring
 * `{ type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr1:1-100' }` renders a
 * default view and says nothing about why; those two are launch keys and
 * belong inside `init`. The known set is read off the composed model, so it
 * cannot drift as a view gains properties.
 *
 * The capture is a `preProcessSnapshot`, which is **not** once per view: the
 * session's view type is a `types.union`, so every member's preprocessor runs
 * against every candidate snapshot while MST decides which one matches, and it
 * runs several times more per instantiation. So the preprocessor stays pure and
 * `afterAttach` — reached only by a snapshot that won — does the reporting.
 *
 * ORDER: MST runs preprocessors in the reverse of the order they were added,
 * and a composed base's after all of them. So this belongs on the chain BEFORE
 * a view's own legacy-key `preProcessSnapshot`, where it sees the snapshot MST
 * finally consumes rather than capturing a key that remap converts. `legacy`
 * names what it still cannot see: the keys a composed base converts.
 */
export function captureUnknownSnapshotKeys<M extends IAnyModelType>(
  model: M,
  { legacy = [] }: { legacy?: readonly string[] } = {},
): M {
  const known = new Set([...Object.keys(model.properties), ...legacy, BUCKET])
  return model
    .props({
      [BUCKET]: types.frozen<Record<string, unknown> | undefined>(),
    })
    .preProcessSnapshot((snap: unknown) => {
      if (!snap || typeof snap !== 'object') {
        return snap
      }
      const kept: Record<string, unknown> = {}
      const unknown: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(snap)) {
        ;(known.has(key) ? kept : unknown)[key] = value
      }
      return Object.keys(unknown).length ? { ...kept, [BUCKET]: unknown } : snap
    })
    .actions(self => ({
      afterAttach() {
        reportUnknownKeys(self, Object.keys(self.unknownSnapshotKeys ?? {}))
      },
    }))
    .postProcessSnapshot((snap: Record<string, unknown>) => {
      const rest = { ...snap }
      delete rest[BUCKET]
      return rest
    }) as unknown as M
}
