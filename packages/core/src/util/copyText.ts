import copyToClipboard from './copyToClipboard.ts'
import { getSession } from './mstUtils.ts'

import type { CopyOptions } from './copyToClipboard.ts'
import type { AbstractSessionModel } from './types/index.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Copy `text` to the clipboard, confirming it in a snackbar (`what` names what
 * landed — "read name", "EDEN.1:c.93+1", "feature info") and surfacing a failure
 * rather than silently doing nothing.
 *
 * Every display that offered a copy item had grown its own copy of this wrapper,
 * and they had drifted on both the wording and whether an error reached the user
 * at all. Take this when you hold a session; `copyText` when you hold a model.
 */
export async function copyTextWithSession(
  session: Pick<AbstractSessionModel, 'notify' | 'notifyError'>,
  text: string,
  what: string,
  options?: CopyOptions,
) {
  try {
    // awaited: copyToClipboard reports a rejected write by throwing, so without
    // this the snackbar confirms a copy that never landed
    await copyToClipboard(text, options)
    session.notify(`Copied ${what} to clipboard`, 'success')
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

/**
 * `copyTextWithSession` for a menu item on a model, which is what a display has
 * in hand.
 */
export async function copyText(
  node: IAnyStateTreeNode,
  text: string,
  what: string,
  options?: CopyOptions,
) {
  return copyTextWithSession(getSession(node), text, what, options)
}
