import { isAlive } from '@jbrowse/mobx-state-tree'

import { getNotificationSink } from './sessionServices.ts'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * #api core/util
 * Run a display's `afterAttach` body from a module loaded on demand, so the
 * autorun installers stay out of the display's eager bundle.
 *
 * One policy for the gap the `await` opens: a node torn down before the module
 * lands installs nothing, and a module that fails to load is reported where the
 * user can see it rather than onto the display's own error slot — that slot is
 * what `reload()` clears, and nothing would re-run the install behind it.
 * Three displays hand-rolled this IIFE and each drew the lines differently.
 */
export function runLazyAfterAttach<Self extends IStateTreeNode>(
  self: Self,
  load: () => Promise<(self: Self) => void>,
) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const install = await load()
      if (isAlive(self)) {
        install(self)
      }
    } catch (e) {
      if (isAlive(self)) {
        console.error(e)
        getNotificationSink(self).notifyError(`${e}`, e)
      }
    }
  })()
}
