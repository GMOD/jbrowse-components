import { getType, types } from '@jbrowse/mobx-state-tree'

import { getNotificationSink } from './sessionServices.ts'

import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

const BUCKET = 'unknownSnapshotKeys'

interface CaptureHost extends IStateTreeNode {
  type?: string
  unknownSnapshotKeys?: Record<string, unknown>
}

function report(self: CaptureHost) {
  const keys = Object.keys(self.unknownSnapshotKeys ?? {})
  if (!keys.length) {
    return
  }
  const message = `${self.type ?? getType(self).name} ignored unknown key(s): ${keys.join(', ')}`
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
        report(self as CaptureHost)
      },
    }))
    .postProcessSnapshot((snap: Record<string, unknown>) => {
      const { [BUCKET]: _captured, ...rest } = snap
      return rest
    }) as unknown as M
}
