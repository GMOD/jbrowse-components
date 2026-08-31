import { getType } from '@jbrowse/mobx-state-tree'

import { getNotificationSink } from './sessionServices.ts'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/** what a diagnostic calls the view: its snapshot `type`, or the model name */
export function viewLabel(self: IStateTreeNode) {
  return (self as IStateTreeNode & { type?: string }).type ?? getType(self).name
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
 * Name the keys a view was handed and could not place, from the partition
 * `withLaunchInput` runs on the snapshot.
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
 * What every surface calls v4's nested `init`. v5 takes every setting directly
 * on the view object, so the key names no declared property and nothing reads
 * what is under it — the view opens on its defaults, which is why this says
 * more than the generic unknown-key line would.
 */
export function legacyInitMessage(label: string) {
  return `${label} nests its settings under "init", which v5 removed: write every setting directly on the view object.`
}

/** Name a snapshot that still writes v4's nested `init`. */
export function reportLegacyInit(self: IStateTreeNode) {
  const message = legacyInitMessage(viewLabel(self))
  console.warn(message)
  try {
    getNotificationSink(self).notify(message, 'warning')
  } catch {
    // a view built outside a session has nowhere to put it
  }
}
