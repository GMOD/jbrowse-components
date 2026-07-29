import { getSession } from './mstUtils.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Copy `text` to the clipboard from a menu item, confirming it in a snackbar
 * (`what` names what landed — "read name", "EDEN.1:c.93+1", "feature info") and
 * surfacing a failure rather than silently doing nothing.
 *
 * This is what a menu item wants; `copyToClipboard` is the bare DOM write under
 * it. Every display that offered a copy item had grown its own copy of this
 * wrapper, and they had drifted on both the wording and whether an error
 * reached the user at all.
 *
 * `copyToClipboard` is imported dynamically so its DOM/execCommand fallback
 * stays out of the initial bundle — which only works because this module is
 * separate from it, so keep it that way.
 */
export async function copyText(
  node: IAnyStateTreeNode,
  text: string,
  what: string,
) {
  const session = getSession(node)
  try {
    const { default: copy } = await import('./copyToClipboard.ts')
    copy(text)
    session.notify(`Copied ${what} to clipboard`, 'success')
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
